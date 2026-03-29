from datetime import datetime, timezone

from app.services.news import ChainedNewsProvider, NewsSentimentService
from tests.helpers import FakeNewsProvider


def test_news_sentiment_service_caches_results():
    provider = FakeNewsProvider()
    service = NewsSentimentService(provider=provider, ttl_seconds=3600, headline_limit=8)

    first = service.get_sentiment("AAPL")
    second = service.get_sentiment("AAPL")

    assert first.news_score == second.news_score
    assert provider.calls == 1


def test_news_sentiment_service_falls_back_to_neutral_when_no_articles():
    service = NewsSentimentService(provider=FakeNewsProvider(), ttl_seconds=3600, headline_limit=8)

    result = service.get_sentiment("NVDA")

    assert result.news_score == 0.0
    assert result.sentiment_label == "NEUTRAL"
    assert result.article_count == 0


def test_chained_news_provider_uses_fallback_provider():
    class EmptyProvider:
        def fetch_news(self, symbol: str, limit: int):
            return []

    fallback = FakeNewsProvider()
    provider = ChainedNewsProvider([EmptyProvider(), fallback])

    result = provider.fetch_news("AAPL", 4)

    assert result
    assert fallback.calls == 1


def test_finnhub_articles_parse_unix_timestamps():
    class FinnhubLikeProvider:
        def fetch_news(self, symbol: str, limit: int):
            return [
                {
                    "headline": "Apple gains on strong demand",
                    "summary": "Analysts stay optimistic",
                    "datetime": 1711718400,
                    "source": "Finnhub",
                    "url": "https://example.com/apple",
                }
            ]

    service = NewsSentimentService(provider=FinnhubLikeProvider(), ttl_seconds=3600, headline_limit=8)

    result = service.get_sentiment("AAPL")

    assert result.article_count == 1
    assert result.articles[0].publisher == "Finnhub"
    assert result.articles[0].published_at == datetime.fromtimestamp(1711718400, tz=timezone.utc)


def test_news_sentiment_service_uses_symbol_fallback_for_europe_tickers():
    service = NewsSentimentService(provider=FakeNewsProvider(), ttl_seconds=3600, headline_limit=8)

    result = service.get_sentiment("SAP.DE")

    assert result.sentiment_label == "POSITIVE"
    assert result.article_count == 2
    assert result.news_score > 0


def test_news_sentiment_service_uses_symbol_fallback_for_india_tickers():
    service = NewsSentimentService(provider=FakeNewsProvider(), ttl_seconds=3600, headline_limit=8)

    result = service.get_sentiment("RELIANCE.NS")

    assert result.sentiment_label == "POSITIVE"
    assert result.article_count == 2
    assert result.news_score > 0


def test_news_sentiment_service_keeps_regional_news_neutral_when_coverage_is_thin():
    service = NewsSentimentService(provider=FakeNewsProvider(), ttl_seconds=3600, headline_limit=8)

    result = service.get_sentiment("ASML.AS")

    assert result.sentiment_label == "NEUTRAL"
    assert result.news_score == 0.0
    assert "neutral" in result.note.lower()
