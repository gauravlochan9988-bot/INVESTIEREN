from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from json import loads
from typing import List, Optional, Protocol
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from app.core.config import get_settings
from app.services.cache import TTLCache


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

        try:
            raw_articles = self.provider.fetch_news(normalized_symbol, self.headline_limit)
            snapshot = self._build_snapshot(normalized_symbol, raw_articles)
        except Exception:
            stale = self.cache.get_stale(normalized_symbol)
            if stale is not None:
                return stale
            snapshot = self._neutral_snapshot(
                normalized_symbol,
                "No recent news could be loaded, so the short-term view leans more on technical signals.",
            )
        return self.cache.set(normalized_symbol, snapshot)

    def _build_snapshot(self, symbol: str, raw_articles: List[dict]) -> NewsSentimentSnapshot:
        articles: List[NewsArticle] = []
        for raw_article in raw_articles[: self.headline_limit]:
            article = self._parse_article(raw_article)
            if article is not None:
                articles.append(article)

        if not articles:
            return self._neutral_snapshot(
                symbol,
                "No recent news was available, so the analysis falls back to technical context.",
            )

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
            symbol=symbol,
            news_score=round(news_score, 2),
            sentiment_label=sentiment_label,
            article_count=len(articles),
            articles=articles,
            note=note,
        )

    def _parse_article(self, raw_article: dict) -> Optional[NewsArticle]:
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
