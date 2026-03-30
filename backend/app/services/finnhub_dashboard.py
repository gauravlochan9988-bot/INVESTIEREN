from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Iterable, Union

import httpx

from app.core.exceptions import ExternalServiceError, ValidationError
from app.schemas.dashboard import (
    DashboardNewsItem,
    DashboardSymbolOverview,
    DashboardWatchlistItem,
)
from app.services.cache import TTLCache


class FinnhubDashboardService:
    BASE_URL = "https://finnhub.io/api/v1"

    def __init__(
        self,
        api_key: str,
        watchlist: Iterable[str],
        ttl_seconds: int = 30,
        timeout_seconds: float = 10.0,
    ) -> None:
        self.api_key = api_key.strip()
        self.watchlist = [symbol.strip().upper() for symbol in watchlist if symbol.strip()]
        self.timeout_seconds = timeout_seconds
        self.watchlist_cache: TTLCache[list[DashboardWatchlistItem]] = TTLCache(ttl_seconds)
        self.symbol_cache: TTLCache[DashboardSymbolOverview] = TTLCache(ttl_seconds)
        self.news_cache: TTLCache[list[DashboardNewsItem]] = TTLCache(ttl_seconds)

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
        payload = self._request("/quote", symbol=symbol)
        if not isinstance(payload, dict) or payload.get("c") in (None, 0):
            raise ExternalServiceError(f"No Finnhub quote data available for {symbol}.")
        return payload

    def _fetch_profile(self, symbol: str) -> dict:
        payload = self._request("/stock/profile2", symbol=symbol)
        if not isinstance(payload, dict) or not payload.get("ticker"):
            raise ExternalServiceError(f"No Finnhub profile available for {symbol}.")
        return payload

    def _build_watchlist_item(self, symbol: str) -> DashboardWatchlistItem:
        quote = self._fetch_quote(symbol)
        profile = self._fetch_profile(symbol)
        return DashboardWatchlistItem(
            symbol=symbol,
            name=profile.get("name") or symbol,
            exchange=profile.get("exchange"),
            logo=profile.get("logo"),
            price=float(quote.get("c") or 0),
            change_percent=float(quote.get("dp") or 0),
            high=float(quote.get("h") or 0),
            low=float(quote.get("l") or 0),
            open=float(quote.get("o") or 0),
            previous_close=float(quote.get("pc") or 0),
        )

    def get_watchlist(self, force_refresh: bool = False) -> list[DashboardWatchlistItem]:
        cache_key = "watchlist"
        if force_refresh:
            self.watchlist_cache.delete(cache_key)
        cached = self.watchlist_cache.get(cache_key)
        if cached is not None:
            return cached

        items: list[DashboardWatchlistItem] = []
        for symbol in self.watchlist:
            try:
                items.append(self._build_watchlist_item(symbol))
            except ExternalServiceError:
                continue

        if not items:
            raise ExternalServiceError("No Finnhub market data available right now.")

        return self.watchlist_cache.set(cache_key, items)

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

        quote = self._fetch_quote(normalized)
        profile = self._fetch_profile(normalized)

        overview = DashboardSymbolOverview(
            symbol=normalized,
            name=profile.get("name") or normalized,
            exchange=profile.get("exchange"),
            finnhub_industry=profile.get("finnhubIndustry"),
            ipo=profile.get("ipo"),
            logo=profile.get("logo"),
            weburl=profile.get("weburl"),
            market_capitalization=profile.get("marketCapitalization"),
            share_outstanding=profile.get("shareOutstanding"),
            price=float(quote.get("c") or 0),
            change_percent=float(quote.get("dp") or 0),
            high=float(quote.get("h") or 0),
            low=float(quote.get("l") or 0),
            open=float(quote.get("o") or 0),
            previous_close=float(quote.get("pc") or 0),
        )
        return self.symbol_cache.set(cache_key, overview)

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
        try:
            payload = self._request(
                "/company-news",
                symbol=normalized,
                **{"from": start.isoformat(), "to": today.isoformat()},
            )
        except ExternalServiceError:
            return self.news_cache.set(cache_key, [])

        if not isinstance(payload, list):
            return self.news_cache.set(cache_key, [])

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

        return self.news_cache.set(cache_key, items)
