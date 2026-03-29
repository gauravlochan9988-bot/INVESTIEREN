from __future__ import annotations

from dataclasses import dataclass
from json import loads
from typing import Iterable, List, Protocol, Sequence
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from app.core.config import get_settings
from app.core.exceptions import ExternalServiceError, ValidationError
from app.schemas.search import SearchResult
from app.services.cache import TTLCache
from app.services.search_catalog import DEFAULT_SEARCH_CATALOG, SearchCatalogEntry


@dataclass(frozen=True)
class SearchSnapshot:
    symbol: str
    name: str


@dataclass(frozen=True)
class CatalogDocument:
    snapshot: SearchSnapshot
    normalized_symbol: str
    normalized_name: str
    normalized_aliases: tuple[str, ...]


SPECIAL_QUERY_MAPPINGS: dict[str, list[SearchSnapshot]] = {
    "s p": [
        SearchSnapshot(symbol="SPY", name="SPDR S&P 500 ETF Trust"),
        SearchSnapshot(symbol="VOO", name="Vanguard S&P 500 ETF"),
        SearchSnapshot(symbol="IVV", name="iShares Core S&P 500 ETF"),
    ],
    "s p 500": [
        SearchSnapshot(symbol="SPY", name="SPDR S&P 500 ETF Trust"),
        SearchSnapshot(symbol="VOO", name="Vanguard S&P 500 ETF"),
        SearchSnapshot(symbol="IVV", name="iShares Core S&P 500 ETF"),
    ],
    "sp": [
        SearchSnapshot(symbol="SPY", name="SPDR S&P 500 ETF Trust"),
        SearchSnapshot(symbol="VOO", name="Vanguard S&P 500 ETF"),
        SearchSnapshot(symbol="IVV", name="iShares Core S&P 500 ETF"),
    ],
    "sp500": [
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


class YFinanceSearchProvider:
    def search(self, query: str, limit: int) -> List[SearchSnapshot]:
        try:
            import yfinance as yf
        except ImportError as exc:
            raise ExternalServiceError(
                "yfinance is not installed. Install backend dependencies to search symbols."
            ) from exc

        try:
            search = yf.Search(
                query=query,
                max_results=max(limit * 2, 8),
                news_count=0,
                lists_count=0,
                include_cb=False,
                include_nav_links=False,
                include_research=False,
                include_cultural_assets=False,
                enable_fuzzy_query=True,
                recommended=0,
                timeout=8,
                raise_errors=True,
            )
        except Exception as error:  # pragma: no cover - network/provider failure path
            raise ExternalServiceError("Failed to load symbol search results from Yahoo Finance.") from error

        results: List[SearchSnapshot] = []
        for item in search.quotes:
            if not isinstance(item, dict):
                continue

            symbol = str(item.get("symbol", "")).strip().upper().replace(".", "-")
            name = str(item.get("longname") or item.get("shortname") or "").strip()
            quote_type = str(item.get("quoteType") or "").upper()

            if not symbol or not name:
                continue
            if not _is_supported_symbol(symbol):
                continue
            if quote_type and quote_type not in {"EQUITY", "ETF", "MUTUALFUND"}:
                continue

            results.append(SearchSnapshot(symbol=symbol, name=name))
            if len(results) >= limit:
                break

        return results


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

            symbol = str(item.get("symbol", "")).strip().upper().replace(".", "-")
            name = str(item.get("description", "")).strip()
            instrument_type = str(item.get("type") or "").upper()

            if not symbol or not name or not _is_supported_symbol(symbol):
                continue
            if instrument_type and instrument_type not in {"COMMON STOCK", "ADR", "ETP", "ETF"}:
                continue

            results.append(SearchSnapshot(symbol=symbol, name=name))
            if len(results) >= limit:
                break

        return results


class CompositeSearchProvider:
    def __init__(self, providers: Iterable[StockSearchProvider]):
        self.providers = tuple(providers)

    def search(self, query: str, limit: int) -> List[SearchSnapshot]:
        results: List[SearchSnapshot] = []
        errors: List[ExternalServiceError] = []

        for provider in self.providers:
            try:
                results.extend(provider.search(query, limit))
            except ExternalServiceError as error:
                errors.append(error)
                continue

            deduped = _dedupe_snapshots(results, limit)
            if len(deduped) >= limit:
                return deduped

        deduped = _dedupe_snapshots(results, limit)
        if deduped:
            return deduped
        if errors:
            raise errors[0]
        return []


class StockSearchService:
    def __init__(
        self,
        provider: StockSearchProvider | None = None,
        ttl_seconds: int = 300,
        catalog_entries: Sequence[SearchCatalogEntry] | None = None,
    ):
        self.provider = provider
        self.cache: TTLCache[List[SearchResult]] = TTLCache(ttl_seconds)
        entries = DEFAULT_SEARCH_CATALOG if catalog_entries is None else tuple(catalog_entries)
        self.catalog = tuple(self._build_catalog_document(entry) for entry in entries)

    def search(self, query: str, limit: int = 8) -> List[SearchResult]:
        normalized_query = query.strip()
        if len(normalized_query) < 1:
            raise ValidationError("Search query must not be empty.")

        capped_limit = max(1, min(limit, 10))
        cache_key = f"{_normalize_text(normalized_query)}:{capped_limit}"
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
        if mapped_results:
            return mapped_results[:limit]

        remote_results = self._provider_results(query, max(limit * 2, 8))
        if remote_results:
            return _dedupe_snapshots(remote_results, limit)

        local_results = self._search_catalog(query, max(limit * 3, 12))
        if local_results:
            return _dedupe_snapshots(local_results, limit)

        fallback_results: List[SearchSnapshot] = list(mapped_results)
        for fallback_query in self._fallback_queries(query):
            fallback_results.extend(self._search_catalog(fallback_query, max(limit * 2, 8)))
            fallback_results.extend(self._provider_results(fallback_query, max(limit * 2, 8)))
            deduped = _dedupe_snapshots(fallback_results, limit)
            if deduped:
                return deduped

        return []

    def _provider_results(self, query: str, limit: int) -> List[SearchSnapshot]:
        if self.provider is None:
            return []

        try:
            return self.provider.search(query, limit)
        except ExternalServiceError:
            return []

    def _should_skip_remote(
        self,
        query: str,
        local_results: Sequence[SearchSnapshot],
        limit: int,
    ) -> bool:
        normalized_query = _normalize_text(query)
        if len(normalized_query) < 2:
            return True
        if len(local_results) >= limit:
            return True
        return any(_normalize_text(snapshot.symbol) == normalized_query for snapshot in local_results)

    def _mapped_results(self, query: str) -> List[SearchSnapshot]:
        normalized = _normalize_text(query)
        matches: List[SearchSnapshot] = []

        if normalized in SPECIAL_QUERY_MAPPINGS:
            matches.extend(SPECIAL_QUERY_MAPPINGS[normalized])

        for key, snapshots in SPECIAL_QUERY_MAPPINGS.items():
            if len(key) > 3 and key in normalized and key != normalized:
                matches.extend(snapshots)

        return _dedupe_snapshots(matches, 10)

    def _search_catalog(self, query: str, limit: int) -> List[SearchSnapshot]:
        normalized_query = _normalize_text(query)
        scored_results: List[tuple[tuple[int, int, int, str], SearchSnapshot]] = []

        for document in self.catalog:
            score = self._score_document(document, normalized_query)
            if score is None:
                continue
            scored_results.append((score, document.snapshot))

        scored_results.sort(key=lambda item: item[0])
        return [snapshot for _, snapshot in scored_results[:limit]]

    def _score_document(
        self,
        document: CatalogDocument,
        normalized_query: str,
    ) -> tuple[int, int, int, str] | None:
        symbol = document.normalized_symbol
        name = document.normalized_name
        aliases = document.normalized_aliases

        if symbol == normalized_query:
            return (0, 0, len(symbol), document.snapshot.symbol)
        if normalized_query in aliases:
            return (0, 1, len(document.snapshot.name), document.snapshot.symbol)

        if symbol.startswith(normalized_query):
            return (1, 0, len(symbol), document.snapshot.symbol)
        alias_prefix = self._best_prefix_position(aliases, normalized_query)
        if alias_prefix is not None:
            return (1, 1, alias_prefix, document.snapshot.symbol)

        token_prefix = self._best_token_prefix(name, aliases, normalized_query)
        if token_prefix is not None:
            return (2, token_prefix, len(document.snapshot.name), document.snapshot.symbol)

        if normalized_query in symbol:
            return (3, symbol.index(normalized_query), len(symbol), document.snapshot.symbol)

        phrase_contains = self._best_contains_position((name, *aliases), normalized_query)
        if phrase_contains is not None:
            return (4, phrase_contains, len(document.snapshot.name), document.snapshot.symbol)

        symbol_subsequence = _subsequence_penalty(symbol, normalized_query)
        if symbol_subsequence is not None:
            return (5, symbol_subsequence, len(symbol), document.snapshot.symbol)

        phrase_subsequence = self._best_subsequence_penalty((name, *aliases), normalized_query)
        if phrase_subsequence is not None:
            return (6, phrase_subsequence, len(document.snapshot.name), document.snapshot.symbol)

        return None

    def _best_prefix_position(self, values: Iterable[str], query: str) -> int | None:
        positions = [len(value) for value in values if value.startswith(query)]
        if not positions:
            return None
        return min(positions)

    def _best_token_prefix(
        self,
        name: str,
        aliases: Sequence[str],
        query: str,
    ) -> int | None:
        token_lengths: List[int] = []
        for phrase in (name, *aliases):
            for token in phrase.split():
                if token.startswith(query):
                    token_lengths.append(len(token))
        if not token_lengths:
            return None
        return min(token_lengths)

    def _best_contains_position(self, values: Iterable[str], query: str) -> int | None:
        positions = [value.index(query) for value in values if query in value]
        if not positions:
            return None
        return min(positions)

    def _best_subsequence_penalty(self, values: Iterable[str], query: str) -> int | None:
        penalties = [
            penalty
            for value in values
            if (penalty := _subsequence_penalty(value, query)) is not None
        ]
        if not penalties:
            return None
        return min(penalties)

    def _fallback_queries(self, query: str) -> List[str]:
        normalized = _normalize_text(query)
        parts = [part for part in normalized.split() if part]
        fallbacks: List[str] = []

        for candidate in [
            normalized.replace(" ", ""),
            parts[0] if parts else "",
            max(parts, key=len) if parts else "",
        ]:
            if candidate and candidate != normalized and candidate not in fallbacks:
                fallbacks.append(candidate)

        return fallbacks

    def _build_catalog_document(self, entry: SearchCatalogEntry) -> CatalogDocument:
        return CatalogDocument(
            snapshot=SearchSnapshot(symbol=entry.symbol, name=entry.name),
            normalized_symbol=_normalize_text(entry.symbol),
            normalized_name=_normalize_text(entry.name),
            normalized_aliases=tuple(
                alias
                for raw_alias in entry.aliases
                if (alias := _normalize_text(raw_alias))
            ),
        )


def _normalize_text(value: str) -> str:
    normalized = "".join(char.lower() if char.isalnum() else " " for char in value)
    return " ".join(normalized.split())


def _is_supported_symbol(symbol: str) -> bool:
    return bool(symbol) and symbol.replace("-", "").isalnum()


def _subsequence_penalty(text: str, query: str) -> int | None:
    cursor = 0
    penalty = 0
    for char in query:
        index = text.find(char, cursor)
        if index == -1:
            return None
        penalty += index - cursor
        cursor = index + 1
    return penalty


def _dedupe_snapshots(snapshots: Sequence[SearchSnapshot], limit: int) -> List[SearchSnapshot]:
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
    remote_providers: List[StockSearchProvider] = [YFinanceSearchProvider()]
    if settings.finnhub_api_key:
        remote_providers.append(FinnhubSearchProvider(settings.finnhub_api_key))

    provider: StockSearchProvider | None = CompositeSearchProvider(remote_providers)
    return StockSearchService(provider=provider)
