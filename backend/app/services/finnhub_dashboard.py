from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
import math
from typing import Iterable, Union

import httpx

from app.core.config import get_settings
from app.core.exceptions import ExternalServiceError, ValidationError
from app.schemas.dashboard import (
    DashboardNewsItem,
    DashboardSymbolOverview,
    DashboardWatchlistItem,
)
from app.services.cache import RequestDeduplicator, TTLCache
from app.services.news import NewsSentimentService


class FinnhubDashboardService:
    BASE_URL = "https://finnhub.io/api/v1"
    TICKER_ALIASES = {
        "BRK.B": "BRK-B",
        "BRK/A": "BRK-A",
        "BRK.A": "BRK-A",
    }

    def __init__(
        self,
        api_key: str,
        watchlist: Iterable[str] | dict[str, str],
        news_sentiment_service: NewsSentimentService | None = None,
        ttl_seconds: int | None = None,
        timeout_seconds: float = 2.0,
    ) -> None:
        settings = get_settings()
        self.api_key = api_key.strip()
        if isinstance(watchlist, dict):
            self.watchlist_names = {
                symbol.strip().upper(): name for symbol, name in watchlist.items() if symbol.strip()
            }
        else:
            self.watchlist_names = {
                symbol.strip().upper(): symbol.strip().upper() for symbol in watchlist if symbol.strip()
            }
        self.watchlist = list(self.watchlist_names.keys())
        self.news_sentiment_service = news_sentiment_service
        self.timeout_seconds = timeout_seconds
        market_ttl = ttl_seconds or settings.market_cache_ttl_seconds
        self.watchlist_cache: TTLCache[list[DashboardWatchlistItem]] = TTLCache(market_ttl)
        self.symbol_cache: TTLCache[DashboardSymbolOverview] = TTLCache(market_ttl)
        self.news_cache: TTLCache[list[DashboardNewsItem]] = TTLCache(settings.news_cache_ttl_seconds)
        self.request_deduper: RequestDeduplicator[
            list[DashboardWatchlistItem] | DashboardSymbolOverview | list[DashboardNewsItem]
        ] = RequestDeduplicator()

    def _ensure_api_key(self) -> None:
        if not self.api_key:
            raise ExternalServiceError("Finnhub API key is not configured.")

    def _normalize_symbol(self, symbol: str) -> str:
        normalized = symbol.strip().upper()
        if not normalized:
            raise ValidationError("Symbol must not be empty.")
        if not normalized.replace(".", "").replace("-", "").isalnum():
            raise ValidationError("Symbol contains unsupported characters.")
        return normalized

    def _normalize_market_symbol(self, symbol: str) -> str:
        normalized = self._normalize_symbol(symbol)
        return self.TICKER_ALIASES.get(normalized, normalized)

    def _request(self, path: str, **params: str) -> Union[dict, list]:
        self._ensure_api_key()
        request_params = {**params, "token": self.api_key}
        url = f"{self.BASE_URL}{path}"
        try:
            with httpx.Client(timeout=self.timeout_seconds) as client:
                response = client.get(url, params=request_params)
                response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code in {401, 403}:
                raise ExternalServiceError("Finnhub rejected the request. Check FINNHUB_API_KEY.") from exc
            if exc.response.status_code == 429:
                raise ExternalServiceError("Finnhub rate limit reached. Try again in a moment.") from exc
            raise ExternalServiceError("Finnhub request failed.") from exc
        except httpx.HTTPError as exc:
            raise ExternalServiceError("Finnhub is currently unavailable.") from exc
        return response.json()

    def _fetch_quote(self, symbol: str) -> dict:
        payload = self._request("/quote", symbol=self._normalize_market_symbol(symbol))
        if not isinstance(payload, dict) or self._valid_price(payload.get("c")) is None:
            raise ExternalServiceError(f"No Finnhub quote data available for {symbol}.")
        return payload

    def _fetch_profile(self, symbol: str) -> dict:
        payload = self._request("/stock/profile2", symbol=self._normalize_market_symbol(symbol))
        if not isinstance(payload, dict) or not payload.get("ticker"):
            raise ExternalServiceError(f"No Finnhub profile available for {symbol}.")
        return payload

    def _partial_symbol_overview(self, symbol: str, quote: dict, profile: dict | None = None) -> DashboardSymbolOverview:
        profile = profile or {}
        price = self._valid_price(quote.get("c"))
        if price is None:
            raise ExternalServiceError(f"No live market data available for {symbol}.")
        return DashboardSymbolOverview(
            symbol=symbol,
            name=profile.get("name") or self.watchlist_names.get(symbol) or symbol,
            data_quality="PARTIAL",
            exchange=profile.get("exchange"),
            finnhub_industry=profile.get("finnhubIndustry"),
            ipo=profile.get("ipo"),
            logo=profile.get("logo"),
            weburl=profile.get("weburl"),
            market_capitalization=profile.get("marketCapitalization"),
            share_outstanding=profile.get("shareOutstanding"),
            price=price,
            change_percent=self._quote_number(quote.get("dp"), 0.0),
            high=self._quote_number(quote.get("h"), price),
            low=self._quote_number(quote.get("l"), price),
            open=self._quote_number(quote.get("o"), price),
            previous_close=self._quote_number(quote.get("pc"), price),
            stale=False,
        )

    def _safe_float(
        self,
        value: object,
        *,
        default: float | None = None,
        allow_none: bool = False,
    ) -> float | None:
        try:
            numeric = float(value)
        except (TypeError, ValueError):
            return None if allow_none else default
        if not math.isfinite(numeric):
            return None if allow_none else default
        return numeric

    def _valid_price(self, value: object) -> float | None:
        numeric = self._safe_float(value, allow_none=True)
        if numeric is None or numeric <= 0:
            return None
        return round(numeric, 2)

    def _quote_number(self, value: object, fallback: float | None = None) -> float | None:
        numeric = self._safe_float(value, allow_none=True)
        if numeric is None:
            return fallback
        return round(numeric, 2)

    def _last_known_symbol_overview(self, symbol: str) -> DashboardSymbolOverview | None:
        cache_key = f"symbol:{symbol}"
        active = self.symbol_cache.get(cache_key)
        stale = self.symbol_cache.get_stale(cache_key)
        for item in (active, stale):
            if item is not None and self._valid_price(item.price) is not None:
                return item.model_copy(update={"stale": True})
        return None

    def _no_data_symbol_overview(self, symbol: str) -> DashboardSymbolOverview:
        return DashboardSymbolOverview(
            symbol=symbol,
            name=self.watchlist_names.get(symbol) or symbol,
            data_quality="NO_DATA",
            price=None,
            change_percent=None,
            high=None,
            low=None,
            open=None,
            previous_close=None,
            stale=False,
            no_data=True,
        )

    def _no_data_watchlist_item(self, symbol: str) -> DashboardWatchlistItem:
        return DashboardWatchlistItem(
            symbol=symbol,
            name=self.watchlist_names.get(symbol) or symbol,
            price=None,
            change_percent=None,
            high=None,
            low=None,
            open=None,
            previous_close=None,
            stale=False,
            no_data=True,
        )

    def _fallback_symbol_overview(self, symbol: str) -> DashboardSymbolOverview:
        lookup_symbol = self._normalize_market_symbol(symbol)
        try:
            import yfinance as yf
        except ImportError as exc:
            raise ExternalServiceError(
                f"No live market data available for {symbol}."
            ) from exc

        try:
            ticker = yf.Ticker(lookup_symbol)
            history = ticker.history(
                period="5d",
                interval="1d",
                auto_adjust=False,
                actions=False,
                raise_errors=False,
            )
        except Exception as exc:
            raise ExternalServiceError(f"No live market data available for {symbol}.") from exc

        if history.empty:
            raise ExternalServiceError(f"No live market data available for {symbol}.")

        history = history.dropna(subset=["Close"])
        if history.empty:
            raise ExternalServiceError(f"No live market data available for {symbol}.")

        current_row = history.iloc[-1]
        previous_row = history.iloc[-2] if len(history.index) > 1 else current_row
        current = self._valid_price(current_row.get("Close"))
        previous = self._valid_price(previous_row.get("Close")) or current
        if current is None or previous is None:
            raise ExternalServiceError(f"No live market data available for {symbol}.")
        change_percent = ((current - previous) / previous * 100) if previous else 0.0

        try:
            info = ticker.info or {}
        except Exception:
            info = {}

        name = (
            info.get("longName")
            or info.get("shortName")
            or info.get("displayName")
            or symbol
        )
        exchange = info.get("exchange") or info.get("fullExchangeName")
        industry = info.get("industry")
        ipo = info.get("ipoExpectedDate") or info.get("firstTradeDateEpochUtc")
        logo = info.get("logo_url") or info.get("logoUrl")
        website = info.get("website")
        market_cap = info.get("marketCap")
        shares_outstanding = info.get("sharesOutstanding")

        return DashboardSymbolOverview(
            symbol=symbol,
            name=name,
            exchange=exchange,
            finnhub_industry=industry,
            ipo=str(ipo) if ipo is not None else None,
            logo=logo,
            weburl=website,
            market_capitalization=self._safe_float(market_cap, allow_none=True),
            share_outstanding=self._safe_float(shares_outstanding, allow_none=True),
            price=current,
            change_percent=round(change_percent, 2),
            high=self._quote_number(current_row.get("High"), current),
            low=self._quote_number(current_row.get("Low"), current),
            open=self._quote_number(current_row.get("Open"), current),
            previous_close=round(previous, 2),
            stale=False,
        )

    def _fallback_watchlist_item(self, symbol: str) -> DashboardWatchlistItem:
        overview = self._fallback_symbol_overview(symbol)
        return DashboardWatchlistItem(
            symbol=overview.symbol,
            name=overview.name,
            exchange=overview.exchange,
            logo=overview.logo,
            price=overview.price,
            change_percent=overview.change_percent,
            high=overview.high,
            low=overview.low,
            open=overview.open,
            previous_close=overview.previous_close,
            stale=overview.stale,
        )

    def _last_known_watchlist_item(self, symbol: str) -> DashboardWatchlistItem | None:
        active = self.watchlist_cache.get("watchlist") or []
        stale = self.watchlist_cache.get_stale("watchlist") or []
        for item in [*active, *stale]:
            if item.symbol == symbol and self._valid_price(item.price) is not None:
                return item.model_copy(update={"stale": True})
        return None

    def _find_item_in_snapshot(
        self,
        snapshot: list[DashboardWatchlistItem] | None,
        symbol: str,
    ) -> DashboardWatchlistItem | None:
        if not snapshot:
            return None
        for item in snapshot:
            if item.symbol == symbol and self._valid_price(item.price) is not None:
                return item
        return None

    def _fallback_company_news(self, symbol: str) -> list[DashboardNewsItem]:
        if self.news_sentiment_service is None:
            return []

        try:
            snapshot = self.news_sentiment_service.get_sentiment(symbol)
        except Exception:
            return []

        items: list[DashboardNewsItem] = []
        for article in snapshot.articles[:6]:
            if not article.url or not article.title:
                continue
            items.append(
                DashboardNewsItem(
                    headline=article.title,
                    source=article.publisher or "News",
                    summary=article.summary,
                    url=article.url,
                    image=None,
                    published_at=article.published_at or datetime.now(timezone.utc),
                )
            )
        return items

    def _build_watchlist_item(self, symbol: str) -> DashboardWatchlistItem:
        try:
            quote = self._fetch_quote(symbol)
            price = self._valid_price(quote.get("c"))
            if price is None:
                raise ExternalServiceError(f"No Finnhub quote data available for {symbol}.")
            return DashboardWatchlistItem(
                symbol=symbol,
                name=self.watchlist_names.get(symbol) or symbol,
                exchange=None,
                logo=None,
                price=price,
                change_percent=self._quote_number(quote.get("dp"), 0.0),
                high=self._quote_number(quote.get("h"), price),
                low=self._quote_number(quote.get("l"), price),
                open=self._quote_number(quote.get("o"), price),
                previous_close=self._quote_number(quote.get("pc"), price),
                stale=False,
            )
        except ExternalServiceError:
            try:
                return self._fallback_watchlist_item(symbol)
            except ExternalServiceError:
                last_known = self._last_known_watchlist_item(symbol)
                if last_known is not None:
                    return last_known
                return self._no_data_watchlist_item(symbol)

    def get_watchlist(self, force_refresh: bool = False) -> list[DashboardWatchlistItem]:
        cache_key = "watchlist"
        stale_snapshot = self.watchlist_cache.get_stale(cache_key) if force_refresh else None
        if force_refresh:
            self.watchlist_cache.delete(cache_key)
        cached = self.watchlist_cache.get(cache_key)
        if cached is not None:
            return cached

        def load_watchlist() -> list[DashboardWatchlistItem]:
            cached_inner = self.watchlist_cache.get(cache_key)
            if cached_inner is not None:
                return cached_inner

            items: list[DashboardWatchlistItem] = []
            for symbol in self.watchlist:
                try:
                    item = self._build_watchlist_item(symbol)
                except ExternalServiceError:
                    last_known = self._find_item_in_snapshot(stale_snapshot, symbol)
                    if last_known is not None:
                        items.append(last_known)
                    continue
                if item.no_data:
                    last_known = self._find_item_in_snapshot(stale_snapshot, symbol)
                    if last_known is not None:
                        items.append(last_known.model_copy(update={"stale": True}))
                        continue
                items.append(item)

            if not items:
                stale = self.watchlist_cache.get_stale(cache_key)
                if stale:
                    return stale
                raise ExternalServiceError("No Finnhub market data available right now.")

            return self.watchlist_cache.set(cache_key, items)

        return self.request_deduper.run(f"dashboard:{cache_key}", load_watchlist)

    def get_symbol_overview(
        self, symbol: str, force_refresh: bool = False
    ) -> DashboardSymbolOverview:
        normalized = self._normalize_symbol(symbol)
        cache_key = f"symbol:{normalized}"
        if force_refresh:
            self.symbol_cache.delete(cache_key)
        cached = self.symbol_cache.get(cache_key)
        if cached is not None:
            return cached

        def load_symbol() -> DashboardSymbolOverview:
            cached_inner = self.symbol_cache.get(cache_key)
            if cached_inner is not None:
                return cached_inner

            try:
                quote = self._fetch_quote(normalized)
            except ExternalServiceError:
                try:
                    overview = self._fallback_symbol_overview(normalized)
                except Exception:
                    last_known = self._last_known_symbol_overview(normalized)
                    if last_known is not None:
                        return last_known
                    return self._no_data_symbol_overview(normalized)
                return self.symbol_cache.set(cache_key, overview)

            try:
                profile = self._fetch_profile(normalized)
                price = self._valid_price(quote.get("c"))
                if price is None:
                    raise ExternalServiceError(f"No Finnhub quote data available for {normalized}.")
                overview = DashboardSymbolOverview(
                    symbol=normalized,
                    name=profile.get("name") or normalized,
                    data_quality="FULL",
                    exchange=profile.get("exchange"),
                    finnhub_industry=profile.get("finnhubIndustry"),
                    ipo=profile.get("ipo"),
                    logo=profile.get("logo"),
                    weburl=profile.get("weburl"),
                    market_capitalization=profile.get("marketCapitalization"),
                    share_outstanding=profile.get("shareOutstanding"),
                    price=price,
                    change_percent=self._quote_number(quote.get("dp"), 0.0),
                    high=self._quote_number(quote.get("h"), price),
                    low=self._quote_number(quote.get("l"), price),
                    open=self._quote_number(quote.get("o"), price),
                    previous_close=self._quote_number(quote.get("pc"), price),
                    stale=False,
                )
            except ExternalServiceError:
                overview = self._partial_symbol_overview(normalized, quote)

            return self.symbol_cache.set(cache_key, overview)

        return self.request_deduper.run(f"dashboard:{cache_key}", load_symbol)

    def get_company_news(
        self, symbol: str, force_refresh: bool = False
    ) -> list[DashboardNewsItem]:
        normalized = self._normalize_symbol(symbol)
        cache_key = f"news:{normalized}"
        if force_refresh:
            self.news_cache.delete(cache_key)
        cached = self.news_cache.get(cache_key)
        if cached is not None:
            return cached

        today = date.today()
        start = today - timedelta(days=7)
        def load_news() -> list[DashboardNewsItem]:
            cached_inner = self.news_cache.get(cache_key)
            if cached_inner is not None:
                return cached_inner

            try:
                payload = self._request(
                    "/company-news",
                    symbol=normalized,
                    **{"from": start.isoformat(), "to": today.isoformat()},
                )
            except ExternalServiceError:
                stale = self.news_cache.get_stale(cache_key)
                if stale:
                    return stale
                return self.news_cache.set(cache_key, self._fallback_company_news(normalized))

            if not isinstance(payload, list):
                return self.news_cache.set(cache_key, self._fallback_company_news(normalized))

            items: list[DashboardNewsItem] = []
            for article in payload[:6]:
                url = article.get("url")
                headline = article.get("headline")
                if not url or not headline:
                    continue

                published_at = datetime.fromtimestamp(
                    int(article.get("datetime") or 0),
                    tz=timezone.utc,
                )
                items.append(
                    DashboardNewsItem(
                        headline=headline,
                        source=article.get("source"),
                        summary=article.get("summary"),
                        url=url,
                        image=article.get("image"),
                        published_at=published_at,
                    )
                )

            if items:
                return self.news_cache.set(cache_key, items)
            return self.news_cache.set(cache_key, self._fallback_company_news(normalized))

        return self.request_deduper.run(f"dashboard:{cache_key}", load_news)
