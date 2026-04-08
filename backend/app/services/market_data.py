from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeoutError
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Dict, Iterable, List, Optional, Protocol

import httpx

from app.core.config import get_settings
from app.core.exceptions import ExternalServiceError, NotFoundError, ValidationError
from app.schemas.stocks import HistoryPoint, StockQuote
from app.services.cache import RequestDeduplicator, TTLCache


SUPPORTED_RANGES: Dict[str, str] = {
    "1mo": "1mo",
    "3mo": "3mo",
    "6mo": "6mo",
    "1y": "1y",
}

NO_LIVE_MARKET_DATA_MESSAGE = "No live market data available."
TICKER_ALIASES: Dict[str, str] = {
    "BRK.B": "BRK-B",
    "BRK/A": "BRK-A",
    "BRK.A": "BRK-A",
}


@dataclass
class QuoteSnapshot:
    symbol: str
    name: str
    price: float
    change_percent: float
    volume: int
    updated_at: datetime
    stale: bool = False


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
            points.append(
                HistoryPoint(
                    date=dt,
                    open=round(float(row["Open"]), 4) if row.get("Open") is not None else None,
                    high=round(float(row["High"]), 4) if row.get("High") is not None else None,
                    low=round(float(row["Low"]), 4) if row.get("Low") is not None else None,
                    close=round(float(row["Close"]), 4),
                    volume=int(row.get("Volume") or 0),
                )
            )
        return points


class FinnhubQuoteProvider:
    BASE_URL = "https://finnhub.io/api/v1"

    def __init__(self, api_key: str, timeout_seconds: float = 2.0):
        self.api_key = api_key.strip()
        self.timeout_seconds = timeout_seconds

    def _ensure_api_key(self) -> None:
        if not self.api_key:
            raise ExternalServiceError("Finnhub API key is not configured.")

    def _market_symbol(self, symbol: str) -> str:
        normalized = symbol.strip().upper()
        return TICKER_ALIASES.get(normalized, normalized)

    def fetch_quotes(
        self, symbols: Iterable[str], names: Dict[str, str]
    ) -> List[QuoteSnapshot]:
        self._ensure_api_key()
        symbols_list = list(symbols)
        snapshots: List[QuoteSnapshot] = []
        updated_at = datetime.now(timezone.utc)

        try:
            with httpx.Client(timeout=self.timeout_seconds) as client:
                for symbol in symbols_list:
                    response = client.get(
                        f"{self.BASE_URL}/quote",
                        params={"symbol": self._market_symbol(symbol), "token": self.api_key},
                    )
                    response.raise_for_status()
                    payload = response.json()
                    current = float(payload.get("c") or 0)
                    if current <= 0:
                        if len(symbols_list) == 1:
                            raise ExternalServiceError(f"No Finnhub quote data available for {symbol}.")
                        continue
                    snapshots.append(
                        QuoteSnapshot(
                            symbol=symbol,
                            name=names.get(symbol, symbol),
                            price=round(current, 2),
                            change_percent=round(float(payload.get("dp") or 0), 2),
                            volume=0,
                            updated_at=updated_at,
                        )
                    )
        except httpx.HTTPError as exc:
            raise ExternalServiceError("Finnhub is currently unavailable.") from exc

        if not snapshots:
            raise ExternalServiceError("No Finnhub quote data available.")
        return snapshots

    def fetch_history(self, symbol: str, period: str) -> List[HistoryPoint]:
        raise ExternalServiceError("Finnhub history lookup is not configured for this service.")


class CompositeMarketDataProvider:
    def __init__(self, providers: Iterable[MarketDataProvider], timeout_seconds: float = 2.0):
        self.providers = list(providers)
        self.timeout_seconds = timeout_seconds

    def _run_with_timeout(self, fn, *args):
        with ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(fn, *args)
            try:
                return future.result(timeout=self.timeout_seconds)
            except FutureTimeoutError as exc:
                raise ExternalServiceError("Market data provider timed out.") from exc

    def fetch_quotes(
        self, symbols: Iterable[str], names: Dict[str, str]
    ) -> List[QuoteSnapshot]:
        ordered_symbols = list(symbols)
        remaining = ordered_symbols[:]
        collected: Dict[str, QuoteSnapshot] = {}
        last_error: Exception | None = None

        for provider in self.providers:
            if not remaining:
                break
            try:
                snapshots = self._run_with_timeout(provider.fetch_quotes, remaining, names)
            except (ExternalServiceError, NotFoundError) as error:
                last_error = error
                continue

            for snapshot in snapshots:
                normalized = snapshot.symbol.strip().upper()
                if normalized in remaining and snapshot.price > 0:
                    collected[normalized] = snapshot

            remaining = [symbol for symbol in remaining if symbol not in collected]

        if not collected:
            raise ExternalServiceError(NO_LIVE_MARKET_DATA_MESSAGE) from last_error

        return [collected[symbol] for symbol in ordered_symbols if symbol in collected]

    def fetch_history(self, symbol: str, period: str) -> List[HistoryPoint]:
        last_error: Exception | None = None
        for provider in self.providers:
            try:
                history = self._run_with_timeout(provider.fetch_history, symbol, period)
            except (ExternalServiceError, NotFoundError) as error:
                last_error = error
                continue
            if history:
                return history
        raise ExternalServiceError(NO_LIVE_MARKET_DATA_MESSAGE) from last_error


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
        self.request_deduper: RequestDeduplicator[list[StockQuote] | list[HistoryPoint] | StockQuote] = (
            RequestDeduplicator()
        )
        self.quote_cache: TTLCache[List[StockQuote]] = TTLCache(
            ttl_seconds or settings.market_cache_ttl_seconds
        )
        self.history_cache: TTLCache[List[HistoryPoint]] = TTLCache(
            ttl_seconds or settings.indicators_cache_ttl_seconds
        )

    def ensure_supported_symbol(self, symbol: str) -> str:
        normalized = symbol.strip().upper()
        if not normalized:
            raise ValidationError("Symbol must not be empty.")
        if not normalized.replace("-", "").replace(".", "").isalnum():
            raise ValidationError("Symbol contains unsupported characters.")
        return normalized

    def _normalize_symbol(self, symbol: str) -> str:
        normalized = self.ensure_supported_symbol(symbol)
        return TICKER_ALIASES.get(normalized, normalized)

    def _mark_quote_stale(self, quote: StockQuote) -> StockQuote:
        return quote.model_copy(update={"stale": True})

    def _last_known_quote(self, symbol: str) -> StockQuote | None:
        normalized = self.ensure_supported_symbol(symbol)
        cache_key = f"quote:{normalized}"
        active = self.quote_cache.get(cache_key) or []
        stale = self.quote_cache.get_stale(cache_key) or []
        watchlist_active = self.quote_cache.get("watchlist") or []
        watchlist_stale = self.quote_cache.get_stale("watchlist") or []

        for bucket in (active, stale, watchlist_active, watchlist_stale):
            for item in bucket:
                if item.symbol == normalized and item.price > 0:
                    return item
        return None

    def get_watchlist_quotes(self, force_refresh: bool = False) -> List[StockQuote]:
        cache_key = "watchlist"
        stale_snapshot = self.quote_cache.get_stale(cache_key) if force_refresh else None
        if force_refresh:
            self.quote_cache.delete(cache_key)
        cached = self.quote_cache.get(cache_key)
        if cached is not None:
            return cached

        def load_quotes() -> List[StockQuote]:
            cached_inner = self.quote_cache.get(cache_key)
            if cached_inner is not None:
                return cached_inner

            try:
                symbols = list(self.allowed_symbols.keys())
                snapshots = self.provider.fetch_quotes(symbols, self.allowed_symbols)
                snapshot_map = {snapshot.symbol: snapshot for snapshot in snapshots if snapshot.price > 0}
                quotes: List[StockQuote] = []
                for symbol in symbols:
                    snapshot = snapshot_map.get(symbol)
                    if snapshot is not None:
                        quote = StockQuote(
                            symbol=snapshot.symbol,
                            name=snapshot.name,
                            price=snapshot.price,
                            change_percent=snapshot.change_percent,
                            volume=snapshot.volume,
                            updated_at=snapshot.updated_at,
                            stale=snapshot.stale,
                        )
                        self.quote_cache.set(f"quote:{symbol}", [quote])
                        quotes.append(quote)
                        continue

                    last_known = self._last_known_quote(symbol)
                    if last_known is not None:
                        quotes.append(self._mark_quote_stale(last_known))
            except (ExternalServiceError, NotFoundError) as error:
                stale = self.quote_cache.get_stale(cache_key)
                if stale is not None:
                    return [self._mark_quote_stale(quote) for quote in stale]
                if stale_snapshot is not None:
                    return [self._mark_quote_stale(quote) for quote in stale_snapshot]
                raise ExternalServiceError(NO_LIVE_MARKET_DATA_MESSAGE) from error
            if not quotes:
                stale = self.quote_cache.get_stale(cache_key)
                if stale is not None:
                    return [self._mark_quote_stale(quote) for quote in stale]
                if stale_snapshot is not None:
                    return [self._mark_quote_stale(quote) for quote in stale_snapshot]
                raise ExternalServiceError(NO_LIVE_MARKET_DATA_MESSAGE)
            return self.quote_cache.set(cache_key, quotes)

        return self.request_deduper.run(f"quotes:{cache_key}", load_quotes)

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
        stale_snapshot = self.history_cache.get_stale(cache_key) if force_refresh else None
        if force_refresh:
            self.history_cache.delete(cache_key)
        cached = self.history_cache.get(cache_key)
        if cached is not None:
            return cached

        def load_history() -> List[HistoryPoint]:
            cached_inner = self.history_cache.get(cache_key)
            if cached_inner is not None:
                return cached_inner
            try:
                history = self.provider.fetch_history(normalized, period)
            except ExternalServiceError as error:
                stale = self.history_cache.get_stale(cache_key)
                if stale is not None:
                    return stale
                if stale_snapshot is not None:
                    return stale_snapshot
                raise ExternalServiceError(NO_LIVE_MARKET_DATA_MESSAGE) from error
            return self.history_cache.set(cache_key, history)

        return self.request_deduper.run(f"history:{cache_key}", load_history)

    def get_latest_quote(self, symbol: str, force_refresh: bool = False) -> StockQuote:
        normalized = self.ensure_supported_symbol(symbol)

        cache_key = f"quote:{normalized}"
        stale_snapshot = self.quote_cache.get_stale(cache_key) if force_refresh else None
        if force_refresh:
            self.quote_cache.delete(cache_key)
        cached = self.quote_cache.get(cache_key)
        if cached is not None and cached:
            return cached[0]

        def load_quote() -> StockQuote:
            cached_inner = self.quote_cache.get(cache_key)
            if cached_inner is not None and cached_inner:
                return cached_inner[0]

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
                    stale=snapshots[0].stale,
                )
            except ExternalServiceError as error:
                last_known = self._last_known_quote(normalized)
                if last_known is not None:
                    return self._mark_quote_stale(last_known)
                stale = self.quote_cache.get_stale(cache_key)
                if stale is not None and stale:
                    return self._mark_quote_stale(stale[0])
                if stale_snapshot is not None and stale_snapshot:
                    return self._mark_quote_stale(stale_snapshot[0])
                raise ExternalServiceError(NO_LIVE_MARKET_DATA_MESSAGE) from error
            self.quote_cache.set(cache_key, [quote])
            return quote

        return self.request_deduper.run(f"quote:{cache_key}", load_quote)
