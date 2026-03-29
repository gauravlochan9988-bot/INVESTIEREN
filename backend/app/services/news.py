from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from json import loads
from typing import Iterable, List, Optional, Protocol
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from app.core.config import get_settings
from app.services.cache import TTLCache
from app.services.regions import resolve_market_region
from app.services.search_catalog import DEFAULT_SEARCH_CATALOG, SearchCatalogEntry


POSITIVE_NEWS_TERMS = {
    "beat",
    "beats",
    "bullish",
    "growth",
    "gain",
    "gains",
    "strong",
    "surge",
    "surges",
    "rally",
    "rallies",
    "upgrade",
    "upgrades",
    "record",
    "profit",
    "profits",
    "outperform",
    "partnership",
    "expands",
    "expansion",
    "optimistic",
}

NEGATIVE_NEWS_TERMS = {
    "miss",
    "misses",
    "downgrade",
    "downgrades",
    "lawsuit",
    "probe",
    "risk",
    "risks",
    "warning",
    "warns",
    "fraud",
    "decline",
    "declines",
    "falls",
    "drop",
    "drops",
    "selloff",
    "bearish",
    "cuts",
    "cut",
    "weak",
    "layoff",
    "layoffs",
}

REGIONAL_BUSINESS_TERMS = {
    "us": {"guidance", "earnings", "revenue", "upgrade", "downgrade"},
    "europe": {"contract", "outlook", "margin", "demand", "europe"},
    "india": {"order", "rupee", "india", "stake", "approval", "capex"},
}


@dataclass(frozen=True)
class NewsLookupContext:
    symbol: str
    region: str
    aliases: tuple[str, ...]
    company_terms: tuple[str, ...]
    lookup_candidates: tuple[str, ...]


@dataclass
class NewsArticle:
    title: str
    summary: str
    published_at: Optional[datetime]
    publisher: str
    url: str
    sentiment_score: int


@dataclass
class NewsSentimentSnapshot:
    symbol: str
    news_score: float
    sentiment_label: str
    article_count: int
    articles: List[NewsArticle]
    note: str


class NewsProvider(Protocol):
    def fetch_news(self, symbol: str, limit: int) -> List[dict]:
        ...


class YFinanceNewsProvider:
    def fetch_news(self, symbol: str, limit: int) -> List[dict]:
        import yfinance as yf

        ticker = yf.Ticker(symbol)
        return list(ticker.get_news(count=limit))


class FinnhubNewsProvider:
    base_url = "https://finnhub.io/api/v1/company-news"

    def __init__(self, api_key: str):
        self.api_key = api_key.strip()

    def fetch_news(self, symbol: str, limit: int) -> List[dict]:
        if not self.api_key:
            return []

        today = datetime.now(timezone.utc).date()
        start = today - timedelta(days=10)
        params = urlencode(
            {
                "symbol": symbol,
                "from": start.isoformat(),
                "to": today.isoformat(),
                "token": self.api_key,
            }
        )
        request = Request(
            f"{self.base_url}?{params}",
            headers={"User-Agent": "investieren-backend/1.0"},
        )

        try:
            with urlopen(request, timeout=8) as response:
                payload = loads(response.read().decode("utf-8"))
        except (HTTPError, URLError, TimeoutError) as error:
            raise RuntimeError("Finnhub news request failed") from error

        if not isinstance(payload, list):
            return []
        return payload[:limit]


class ChainedNewsProvider:
    def __init__(self, providers: List[NewsProvider]):
        self.providers = providers

    def fetch_news(self, symbol: str, limit: int) -> List[dict]:
        last_error: Exception | None = None
        for provider in self.providers:
            try:
                articles = provider.fetch_news(symbol, limit)
            except Exception as error:  # pragma: no cover - exercised through service fallback
                last_error = error
                continue

            if articles:
                return articles[:limit]

        if last_error is not None:
            raise last_error
        return []


class NewsSentimentService:
    def __init__(
        self,
        provider: NewsProvider,
        ttl_seconds: Optional[int] = None,
        headline_limit: Optional[int] = None,
    ):
        settings = get_settings()
        self.provider = provider
        self.headline_limit = headline_limit or settings.news_headline_limit
        self.cache: TTLCache[NewsSentimentSnapshot] = TTLCache(
            ttl_seconds or settings.news_cache_ttl_seconds
        )

    def get_sentiment(self, symbol: str) -> NewsSentimentSnapshot:
        normalized_symbol = symbol.strip().upper()
        cached = self.cache.get(normalized_symbol)
        if cached is not None:
            return cached

        context = self._build_lookup_context(normalized_symbol)
        try:
            raw_articles = self._fetch_articles(context)
            snapshot = self._build_snapshot(context, raw_articles)
        except Exception:
            stale = self.cache.get_stale(normalized_symbol)
            if stale is not None:
                return stale
            snapshot = self._neutral_snapshot(
                normalized_symbol,
                "No reliable recent news could be loaded, so the short-term view leans more on technical signals.",
            )
        return self.cache.set(normalized_symbol, snapshot)

    def _build_snapshot(
        self,
        context: NewsLookupContext,
        raw_articles: List[dict],
    ) -> NewsSentimentSnapshot:
        articles: List[NewsArticle] = []
        for raw_article in raw_articles[: self.headline_limit]:
            article = self._parse_article(raw_article, context)
            if article is not None:
                articles.append(article)

        if not articles:
            return self._neutral_snapshot(
                context.symbol,
                "No reliable recent news was available, so the analysis falls back to technical context.",
            )

        reliable_articles = self._reliable_articles(context, articles)
        if not reliable_articles:
            return self._neutral_snapshot(
                context.symbol,
                "Recent headlines were too weak or unrelated, so news stays neutral.",
            )

        confidence_gate = self._news_confidence_gate(context, reliable_articles)
        if confidence_gate is not None:
            return self._neutral_snapshot(context.symbol, confidence_gate)

        articles = reliable_articles
        news_score = sum(article.sentiment_score for article in articles) / len(articles)
        if news_score > 0.2:
            sentiment_label = "POSITIVE"
            note = "Recent headlines are mildly supportive for the next few sessions."
        elif news_score < -0.2:
            sentiment_label = "NEGATIVE"
            note = "Recent headlines lean negative and add short-term headline risk."
        else:
            sentiment_label = "NEUTRAL"
            note = "Recent headlines are mixed, so news does not provide a clear short-term edge."

        return NewsSentimentSnapshot(
            symbol=context.symbol,
            news_score=round(news_score, 2),
            sentiment_label=sentiment_label,
            article_count=len(articles),
            articles=articles,
            note=note,
        )

    def _parse_article(
        self,
        raw_article: dict,
        context: NewsLookupContext,
    ) -> Optional[NewsArticle]:
        if not isinstance(raw_article, dict):
            return None

        content = raw_article.get("content", {})
        if not isinstance(content, dict):
            content = {}

        title = (
            content.get("title")
            or raw_article.get("title")
            or raw_article.get("headline")
            or ""
        ).strip()
        summary = (
            content.get("summary")
            or content.get("description")
            or raw_article.get("summary")
            or ""
        ).strip()
        if not title:
            return None

        published_at = self._parse_datetime(
            content.get("pubDate")
            or raw_article.get("pubDate")
            or raw_article.get("published_at")
            or raw_article.get("datetime")
        )
        publisher = (
            content.get("provider", {}).get("displayName")
            if isinstance(content.get("provider"), dict)
            else None
        ) or raw_article.get("publisher") or raw_article.get("source") or "Yahoo Finance"
        url = (
            (content.get("canonicalUrl") or {}).get("url")
            if isinstance(content.get("canonicalUrl"), dict)
            else None
        ) or (
            (raw_article.get("clickThroughUrl") or {}).get("url")
            if isinstance(raw_article.get("clickThroughUrl"), dict)
            else None
        ) or raw_article.get("url") or ""
        sentiment_score = self._classify_sentiment(title=title, summary=summary)
        if self._relevance_score(title=title, summary=summary, context=context) <= 0:
            return None

        return NewsArticle(
            title=title,
            summary=summary,
            published_at=published_at,
            publisher=publisher,
            url=url,
            sentiment_score=sentiment_score,
        )

    def _classify_sentiment(self, title: str, summary: str) -> int:
        text = f"{title} {summary}".lower()
        positive_hits = sum(1 for term in POSITIVE_NEWS_TERMS if term in text)
        negative_hits = sum(1 for term in NEGATIVE_NEWS_TERMS if term in text)

        if positive_hits > negative_hits:
            return 1
        if negative_hits > positive_hits:
            return -1
        return 0

    def _neutral_snapshot(self, symbol: str, note: str) -> NewsSentimentSnapshot:
        return NewsSentimentSnapshot(
            symbol=symbol,
            news_score=0.0,
            sentiment_label="NEUTRAL",
            article_count=0,
            articles=[],
            note=note,
        )

    def _parse_datetime(self, value: object) -> Optional[datetime]:
        if isinstance(value, datetime):
            return value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)
        if isinstance(value, str):
            try:
                parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
            except ValueError:
                return None
            return parsed if parsed.tzinfo is not None else parsed.replace(tzinfo=timezone.utc)
        if isinstance(value, (int, float)):
            try:
                return datetime.fromtimestamp(value, tz=timezone.utc)
            except (OverflowError, OSError, ValueError):
                return None
        return None

    def _fetch_articles(self, context: NewsLookupContext) -> List[dict]:
        combined: List[dict] = []
        seen_keys: set[str] = set()

        for candidate in context.lookup_candidates:
            raw_articles = self.provider.fetch_news(candidate, self.headline_limit)
            for article in raw_articles:
                key = self._article_key(article)
                if key in seen_keys:
                    continue
                seen_keys.add(key)
                combined.append(article)
                if len(combined) >= self.headline_limit:
                    return combined
            if combined:
                break

        return combined

    def _build_lookup_context(self, symbol: str) -> NewsLookupContext:
        region = resolve_market_region(symbol)
        entry = self._catalog_entry(symbol)
        base_symbol = symbol.split(".", 1)[0]
        aliases = tuple(
            alias.lower()
            for alias in (
                *(entry.aliases if entry is not None else ()),
                base_symbol,
                symbol,
                (entry.name if entry is not None else ""),
            )
            if alias
        )
        company_terms = tuple(
            token
            for token in self._company_terms(entry)
            if len(token) >= 3
        )
        lookup_candidates = self._lookup_candidates(symbol, region)
        return NewsLookupContext(
            symbol=symbol,
            region=region,
            aliases=aliases,
            company_terms=company_terms,
            lookup_candidates=lookup_candidates,
        )

    def _catalog_entry(self, symbol: str) -> SearchCatalogEntry | None:
        normalized = symbol.strip().upper()
        for entry in DEFAULT_SEARCH_CATALOG:
            if entry.symbol == normalized:
                return entry
        return None

    def _company_terms(self, entry: SearchCatalogEntry | None) -> Iterable[str]:
        if entry is None:
            return ()

        cleaned = (
            entry.name.replace("&", " ")
            .replace(".", " ")
            .replace(",", " ")
            .replace("-", " ")
            .lower()
        )
        blocked = {
            "inc",
            "ltd",
            "se",
            "ag",
            "sa",
            "plc",
            "nv",
            "corporation",
            "company",
            "group",
            "holdings",
            "services",
            "class",
        }
        terms = [token for token in cleaned.split() if token not in blocked]
        return tuple(dict.fromkeys(terms))

    def _lookup_candidates(self, symbol: str, region: str) -> tuple[str, ...]:
        candidates = [symbol]
        if "." in symbol:
            base_symbol = symbol.split(".", 1)[0]
            candidates.append(base_symbol)
            if region == "europe" and base_symbol not in {"SAP", "AIR", "MC"}:
                candidates.append(base_symbol.replace("-", ""))
        return tuple(dict.fromkeys(candidate.upper() for candidate in candidates if candidate))

    def _article_key(self, raw_article: dict) -> str:
        if not isinstance(raw_article, dict):
            return ""
        content = raw_article.get("content", {})
        if not isinstance(content, dict):
            content = {}
        title = (
            content.get("title")
            or raw_article.get("title")
            or raw_article.get("headline")
            or ""
        ).strip().lower()
        url = str(raw_article.get("url") or "").strip().lower()
        return f"{title}|{url}"

    def _relevance_score(
        self,
        *,
        title: str,
        summary: str,
        context: NewsLookupContext,
    ) -> int:
        text = f"{title} {summary}".lower()
        alias_hits = sum(1 for alias in context.aliases if alias and alias.lower() in text)
        company_hits = sum(
            1 for term in context.company_terms if term and term.lower() in text
        )
        regional_hits = sum(
            1 for term in REGIONAL_BUSINESS_TERMS.get(context.region, set()) if term in text
        )
        return (alias_hits * 2) + company_hits + regional_hits

    def _reliable_articles(
        self,
        context: NewsLookupContext,
        articles: List[NewsArticle],
    ) -> List[NewsArticle]:
        reliable: List[NewsArticle] = []
        for article in articles:
            relevance = self._relevance_score(
                title=article.title,
                summary=article.summary,
                context=context,
            )
            if relevance >= 2:
                reliable.append(article)
        return reliable

    def _news_confidence_gate(
        self,
        context: NewsLookupContext,
        articles: List[NewsArticle],
    ) -> str | None:
        if context.region == "us":
            return None
        if len(articles) >= 2:
            return None
        if articles and articles[0].sentiment_score == 0:
            return "Regional news was too weak to support a directional view, so sentiment stays neutral."
        return "Regional news coverage was too thin to justify a strong signal, so sentiment stays neutral."
