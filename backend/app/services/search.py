from __future__ import annotations

from dataclasses import dataclass
from json import loads
from typing import List, Protocol
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from app.core.config import get_settings
from app.core.exceptions import ExternalServiceError, ValidationError
from app.schemas.search import SearchResult
from app.services.cache import TTLCache


@dataclass
class SearchSnapshot:
    symbol: str
    name: str


KNOWN_SEARCH_MAPPINGS: dict[str, list[SearchSnapshot]] = {
    "s&p": [
        SearchSnapshot(symbol="SPY", name="SPDR S&P 500 ETF Trust"),
        SearchSnapshot(symbol="VOO", name="Vanguard S&P 500 ETF"),
        SearchSnapshot(symbol="IVV", name="iShares Core S&P 500 ETF"),
    ],
    "sp500": [
        SearchSnapshot(symbol="SPY", name="SPDR S&P 500 ETF Trust"),
        SearchSnapshot(symbol="VOO", name="Vanguard S&P 500 ETF"),
        SearchSnapshot(symbol="IVV", name="iShares Core S&P 500 ETF"),
    ],
    "s&p 500": [
        SearchSnapshot(symbol="SPY", name="SPDR S&P 500 ETF Trust"),
        SearchSnapshot(symbol="VOO", name="Vanguard S&P 500 ETF"),
        SearchSnapshot(symbol="IVV", name="iShares Core S&P 500 ETF"),
    ],
    "nasdaq": [
        SearchSnapshot(symbol="QQQ", name="Invesco QQQ Trust"),
    ],
    "dow": [
        SearchSnapshot(symbol="DIA", name="SPDR Dow Jones Industrial Average ETF Trust"),
    ],
    "core etf": [
        SearchSnapshot(symbol="IVV", name="iShares Core S&P 500 ETF"),
        SearchSnapshot(symbol="VTI", name="Vanguard Total Stock Market ETF"),
        SearchSnapshot(symbol="VXUS", name="Vanguard Total International Stock ETF"),
    ],
}


class StockSearchProvider(Protocol):
    def search(self, query: str, limit: int) -> List[SearchSnapshot]:
        ...


class FinnhubSearchProvider:
    base_url = "https://finnhub.io/api/v1/search"

    def __init__(self, api_key: str):
        self.api_key = api_key.strip()

    def search(self, query: str, limit: int) -> List[SearchSnapshot]:
        if not self.api_key:
            raise ExternalServiceError("Finnhub API key is not configured.")

        params = urlencode({"q": query, "token": self.api_key})
        request = Request(
            f"{self.base_url}?{params}",
            headers={"User-Agent": "investieren-backend/1.0"},
        )
        try:
            with urlopen(request, timeout=8) as response:
                payload = loads(response.read().decode("utf-8"))
        except (HTTPError, URLError, TimeoutError) as error:
            raise ExternalServiceError("Failed to load symbol search results from Finnhub.") from error

        raw_results = payload.get("result", []) if isinstance(payload, dict) else []
        results: List[SearchSnapshot] = []
        for item in raw_results:
            if not isinstance(item, dict):
                continue
            symbol = str(item.get("symbol", "")).strip().upper()
            name = str(item.get("description", "")).strip()
            if not symbol or not name:
                continue
            if "." in symbol:
                continue
            if item.get("type") and str(item.get("type")).upper() not in {"COMMON STOCK", "ADR", "ETP", "ETF"}:
                continue
            results.append(SearchSnapshot(symbol=symbol, name=name))
            if len(results) >= limit:
                break
        return results


class StockSearchService:
    def __init__(self, provider: StockSearchProvider, ttl_seconds: int = 300):
        self.provider = provider
        self.cache: TTLCache[List[SearchResult]] = TTLCache(ttl_seconds)

    def search(self, query: str, limit: int = 8) -> List[SearchResult]:
        normalized_query = query.strip()
        if len(normalized_query) < 1:
            raise ValidationError("Search query must not be empty.")

        capped_limit = max(1, min(limit, 10))
        cache_key = f"{normalized_query.lower()}:{capped_limit}"
        cached = self.cache.get(cache_key)
        if cached is not None:
            return cached

        snapshots = self._search_with_fallbacks(normalized_query, capped_limit)
        results = [
            SearchResult(symbol=snapshot.symbol, name=snapshot.name)
            for snapshot in snapshots[:capped_limit]
        ]
        return self.cache.set(cache_key, results)

    def _search_with_fallbacks(self, query: str, limit: int) -> List[SearchSnapshot]:
        mapped_results = self._mapped_results(query)
        direct_results = self._dedupe(mapped_results + self.provider.search(query, limit), limit)
        if direct_results:
            return direct_results

        fallback_results: List[SearchSnapshot] = list(mapped_results)
        for fallback_query in self._fallback_queries(query):
            fallback_results.extend(self.provider.search(fallback_query, limit))
            deduped = self._dedupe(fallback_results, limit)
            if deduped:
                return deduped

        return self._dedupe(mapped_results, limit)

    def _mapped_results(self, query: str) -> List[SearchSnapshot]:
        normalized = query.strip().lower()
        matches: List[SearchSnapshot] = []
        for key, snapshots in KNOWN_SEARCH_MAPPINGS.items():
            if key in normalized:
                matches.extend(snapshots)
        return self._dedupe(matches, 10)

    def _fallback_queries(self, query: str) -> List[str]:
        lowered = query.strip().lower()
        simplified = "".join(char if char.isalnum() or char.isspace() else " " for char in lowered)
        parts = [part for part in simplified.split() if part]
        fallbacks: List[str] = []
        for candidate in [simplified.strip(), parts[0] if parts else "", max(parts, key=len) if parts else ""]:
            if candidate and candidate != lowered and candidate not in fallbacks:
                fallbacks.append(candidate)
        return fallbacks

    def _dedupe(self, snapshots: List[SearchSnapshot], limit: int) -> List[SearchSnapshot]:
        seen: set[str] = set()
        deduped: List[SearchSnapshot] = []
        for snapshot in snapshots:
            if not snapshot.symbol or snapshot.symbol in seen:
                continue
            seen.add(snapshot.symbol)
            deduped.append(snapshot)
            if len(deduped) >= limit:
                break
        return deduped


def build_stock_search_service() -> StockSearchService:
    settings = get_settings()
    return StockSearchService(provider=FinnhubSearchProvider(settings.finnhub_api_key))
