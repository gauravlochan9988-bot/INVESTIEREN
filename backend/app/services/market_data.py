from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Dict, Iterable, List, Optional, Protocol

from app.core.config import get_settings
from app.core.exceptions import ExternalServiceError, NotFoundError, ValidationError
from app.schemas.stocks import HistoryPoint, StockQuote
from app.services.cache import TTLCache


SUPPORTED_RANGES: Dict[str, str] = {
    "1mo": "1mo",
    "3mo": "3mo",
    "6mo": "6mo",
    "1y": "1y",
}

NO_LIVE_MARKET_DATA_MESSAGE = "No live market data available."

@dataclass
class QuoteSnapshot:
    symbol: str
    name: str
    price: float
    change_percent: float
    volume: int
    updated_at: datetime


class MarketDataProvider(Protocol):
    def fetch_quotes(self, symbols: Iterable[str], names: Dict[str, str]) -> List[QuoteSnapshot]:
        ...

    def fetch_history(self, symbol: str, period: str) -> List[HistoryPoint]:
        ...


class YFinanceProvider:
    def fetch_quotes(
        self, symbols: Iterable[str], names: Dict[str, str]
    ) -> List[QuoteSnapshot]:
        symbols_list = list(symbols)
        try:
            import yfinance as yf
        except ImportError as exc:
            raise ExternalServiceError(
                "yfinance is not installed. Install backend dependencies to fetch live data."
            ) from exc

        try:
            dataset = yf.download(
                tickers=" ".join(symbols_list),
                period="5d",
                interval="1d",
                auto_adjust=False,
                actions=False,
                progress=False,
                group_by="ticker",
                threads=False,
            )
        except Exception as exc:  # pragma: no cover - third-party library failure path
            raise ExternalServiceError("Failed to fetch watchlist market data.") from exc

        if dataset.empty:
            if len(symbols_list) == 1:
                raise NotFoundError(f"No market data found for symbol {symbols_list[0]}.")
            raise ExternalServiceError("No watchlist data returned from yfinance.")

        is_multi_ticker = getattr(getattr(dataset, "columns", None), "nlevels", 1) > 1
        updated_at = datetime.now(timezone.utc)
        snapshots: List[QuoteSnapshot] = []

        for symbol in symbols_list:
            try:
                frame = dataset[symbol] if is_multi_ticker else dataset
                frame = frame.dropna(subset=["Close"])
                if frame.shape[0] < 2:
                    if len(symbols_list) == 1:
                        raise NotFoundError(f"No market data found for symbol {symbol}.")
                    raise ValueError("not enough close prices")
                current = float(frame["Close"].iloc[-1])
                previous = float(frame["Close"].iloc[-2])
                volume = int(frame["Volume"].iloc[-1] or 0)
            except NotFoundError:
                raise
            except Exception as exc:  # pragma: no cover - defensive parsing path
                if len(symbols_list) == 1:
                    raise ExternalServiceError(f"Failed to parse quote data for {symbol}.") from exc
                continue

            change_percent = ((current - previous) / previous * 100) if previous else 0.0
            snapshots.append(
                QuoteSnapshot(
                    symbol=symbol,
                    name=names[symbol],
                    price=round(current, 2),
                    change_percent=round(change_percent, 2),
                    volume=volume,
                    updated_at=updated_at,
                )
            )

        if not snapshots:
            if len(symbols_list) == 1:
                raise NotFoundError(f"No market data found for symbol {symbols_list[0]}.")
            raise ExternalServiceError("No watchlist data returned from yfinance.")

        return snapshots

    def fetch_history(self, symbol: str, period: str) -> List[HistoryPoint]:
        try:
            import yfinance as yf
        except ImportError as exc:
            raise ExternalServiceError(
                "yfinance is not installed. Install backend dependencies to fetch live data."
            ) from exc

        try:
            history = yf.Ticker(symbol).history(
                period=period,
                interval="1d",
                auto_adjust=False,
                actions=False,
                raise_errors=False,
            )
        except Exception as exc:  # pragma: no cover - third-party library failure path
            raise ExternalServiceError(f"Failed to fetch market data for {symbol}.") from exc

        if history.empty:
            raise NotFoundError(f"No market data found for symbol {symbol}.")

        points: List[HistoryPoint] = []
        for timestamp, row in history.iterrows():
            dt = timestamp.to_pydatetime()
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            points.append(HistoryPoint(date=dt, close=round(float(row["Close"]), 4)))
        return points


class MarketDataService:
    def __init__(
        self,
        provider: MarketDataProvider,
        allowed_symbols: Optional[Dict[str, str]] = None,
        ttl_seconds: Optional[int] = None,
    ):
        settings = get_settings()
        self.provider = provider
        self.allowed_symbols = allowed_symbols or settings.watchlist
        self.quote_cache: TTLCache[List[StockQuote]] = TTLCache(
            ttl_seconds or settings.market_cache_ttl_seconds
        )
        self.history_cache: TTLCache[List[HistoryPoint]] = TTLCache(
            ttl_seconds or settings.market_cache_ttl_seconds
        )

    def ensure_supported_symbol(self, symbol: str) -> str:
        normalized = symbol.strip().upper()
        if not normalized:
            raise ValidationError("Symbol must not be empty.")
        if not normalized.replace("-", "").replace(".", "").isalnum():
            raise ValidationError("Symbol contains unsupported characters.")
        return normalized

    def _normalize_symbol(self, symbol: str) -> str:
        return self.ensure_supported_symbol(symbol)

    def get_watchlist_quotes(self, force_refresh: bool = False) -> List[StockQuote]:
        cache_key = "watchlist"
        if force_refresh:
            self.quote_cache.delete(cache_key)
        cached = self.quote_cache.get(cache_key)
        if cached is not None:
            return cached

        symbols = list(self.allowed_symbols.keys())
        try:
            snapshots = self.provider.fetch_quotes(symbols, self.allowed_symbols)
            quotes = [
                StockQuote(
                    symbol=snapshot.symbol,
                    name=snapshot.name,
                    price=snapshot.price,
                    change_percent=snapshot.change_percent,
                    volume=snapshot.volume,
                    updated_at=snapshot.updated_at,
                )
                for snapshot in snapshots
            ]
        except (ExternalServiceError, NotFoundError) as error:
            raise ExternalServiceError(NO_LIVE_MARKET_DATA_MESSAGE) from error
        return self.quote_cache.set(cache_key, quotes)

    def get_history(
        self, symbol: str, range_name: str, force_refresh: bool = False
    ) -> List[HistoryPoint]:
        normalized = self._normalize_symbol(symbol)
        period = SUPPORTED_RANGES.get(range_name)
        if period is None:
            raise ValidationError(
                f"Unsupported range {range_name}. Use one of: {', '.join(SUPPORTED_RANGES)}."
            )

        cache_key = f"{normalized}:{period}"
        if force_refresh:
            self.history_cache.delete(cache_key)
        cached = self.history_cache.get(cache_key)
        if cached is not None:
            return cached
        try:
            history = self.provider.fetch_history(normalized, period)
        except ExternalServiceError as error:
            raise ExternalServiceError(NO_LIVE_MARKET_DATA_MESSAGE) from error
        return self.history_cache.set(cache_key, history)

    def get_latest_quote(self, symbol: str, force_refresh: bool = False) -> StockQuote:
        normalized = self.ensure_supported_symbol(symbol)
        if normalized in self.allowed_symbols:
            quotes = self.get_watchlist_quotes(force_refresh=force_refresh)
            for quote in quotes:
                if quote.symbol == normalized:
                    return quote

        cache_key = f"quote:{normalized}"
        if force_refresh:
            self.quote_cache.delete(cache_key)
        cached = self.quote_cache.get(cache_key)
        if cached is not None and cached:
            return cached[0]

        try:
            snapshots = self.provider.fetch_quotes([normalized], {normalized: normalized})
            if not snapshots:
                raise ExternalServiceError(f"Quote for {normalized} could not be loaded.")
            quote = StockQuote(
                symbol=snapshots[0].symbol,
                name=snapshots[0].name,
                price=snapshots[0].price,
                change_percent=snapshots[0].change_percent,
                volume=snapshots[0].volume,
                updated_at=snapshots[0].updated_at,
            )
        except ExternalServiceError as error:
            raise ExternalServiceError(NO_LIVE_MARKET_DATA_MESSAGE) from error
        self.quote_cache.set(cache_key, [quote])
        return quote
