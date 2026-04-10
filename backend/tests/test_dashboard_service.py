from datetime import datetime, timezone

from app.core.exceptions import ExternalServiceError
from app.schemas.dashboard import DashboardNewsItem
from app.schemas.dashboard import DashboardSymbolOverview
from app.schemas.dashboard import DashboardWatchlistItem
from app.services.finnhub_dashboard import FinnhubDashboardService


def test_symbol_overview_falls_back_when_finnhub_quote_or_profile_fails(monkeypatch):
    service = FinnhubDashboardService(api_key="demo", watchlist=("AAPL",))

    def fail_quote(symbol: str):
        raise ExternalServiceError("quote failed")

    def fallback_overview(symbol: str):
        return DashboardSymbolOverview(
            symbol=symbol,
            name="Fallback Corp",
            exchange="NASDAQ",
            finnhub_industry="Technology",
            ipo=None,
            logo=None,
            weburl="https://example.com",
            market_capitalization=123.0,
            share_outstanding=45.0,
            price=101.25,
            change_percent=1.5,
            high=102.0,
            low=99.5,
            open=100.0,
            previous_close=99.75,
        )

    monkeypatch.setattr(service, "_fetch_quote", fail_quote)
    monkeypatch.setattr(service, "_fallback_symbol_overview", fallback_overview)

    overview = service.get_symbol_overview("SAP.DE", force_refresh=True)

    assert overview.symbol == "SAP.DE"
    assert overview.name == "Fallback Corp"
    assert overview.exchange == "NASDAQ"
    assert overview.price == 101.25


def test_company_news_falls_back_to_sentiment_articles_when_finnhub_fails(monkeypatch):
    service = FinnhubDashboardService(api_key="demo", watchlist=("AAPL",))

    def fail_request(path: str, **params: str):
        raise ExternalServiceError("news failed")

    def fallback_news(symbol: str):
        return [
            DashboardNewsItem(
                headline=f"{symbol} fallback headline",
                source="Fallback",
                summary="Fallback summary",
                url="https://example.com/news",
                image=None,
                published_at=datetime.now(timezone.utc),
            )
        ]

    monkeypatch.setattr(service, "_request", fail_request)
    monkeypatch.setattr(service, "_fallback_company_news", fallback_news)

    items = service.get_company_news("AAPL", force_refresh=True)

    assert items
    assert items[0].headline
    assert items[0].url
    assert isinstance(items[0].published_at, datetime)
    assert items[0].published_at.tzinfo == timezone.utc


def test_watchlist_item_falls_back_to_yfinance_style_overview_when_finnhub_fails(monkeypatch):
    service = FinnhubDashboardService(api_key="demo", watchlist=("AMD",))

    def fail_quote(symbol: str):
        raise ExternalServiceError("quote failed")

    def fallback_watchlist_item(symbol: str):
        return DashboardWatchlistItem(
            symbol=symbol,
            name="AMD",
            exchange="NASDAQ",
            logo=None,
            price=101.25,
            change_percent=1.5,
            high=102.0,
            low=99.5,
            open=100.0,
            previous_close=99.75,
        )

    monkeypatch.setattr(service, "_fetch_quote", fail_quote)
    monkeypatch.setattr(service, "_fallback_watchlist_item", fallback_watchlist_item)

    items = service.get_watchlist(force_refresh=True)

    assert len(items) == 1
    assert items[0].symbol == "AMD"
    assert items[0].price == 101.25


def test_watchlist_item_uses_last_known_price_when_live_sources_fail(monkeypatch):
    service = FinnhubDashboardService(api_key="demo", watchlist=("GOOGL",))

    stale_item = DashboardWatchlistItem(
        symbol="GOOGL",
        name="Alphabet",
        exchange="NASDAQ",
        logo=None,
        price=188.2,
        change_percent=0.8,
        high=189.0,
        low=186.5,
        open=187.0,
        previous_close=186.7,
    )
    service.watchlist_cache.set(
        "watchlist",
        [stale_item],
    )

    def fail_quote(symbol: str):
        raise ExternalServiceError("quote failed")

    def fail_fallback(symbol: str):
        raise ExternalServiceError("fallback failed")

    monkeypatch.setattr(service, "_fetch_quote", fail_quote)
    monkeypatch.setattr(service, "_fallback_watchlist_item", fail_fallback)

    items = service.get_watchlist(force_refresh=True)

    assert len(items) == 1
    assert items[0].symbol == "GOOGL"
    assert items[0].price == 188.2
    assert items[0].stale is True
    assert items[0].quote_status == "stale"
    assert items[0].is_stale is True
    assert items[0].data_source == "stale_cache"


def test_watchlist_item_returns_no_data_when_no_valid_price_exists(monkeypatch):
    service = FinnhubDashboardService(api_key="demo", watchlist=("AMD",))

    def fail_quote(symbol: str):
        raise ExternalServiceError("quote failed")

    def fail_fallback(symbol: str):
        raise ExternalServiceError("fallback failed")

    monkeypatch.setattr(service, "_fetch_quote", fail_quote)
    monkeypatch.setattr(service, "_fallback_watchlist_item", fail_fallback)

    items = service.get_watchlist(force_refresh=True)

    assert len(items) == 1
    assert items[0].symbol == "AMD"
    assert items[0].price is None
    assert items[0].no_data is True
    assert items[0].quote_status in ("no_data", "fetch_error")


def test_symbol_overview_returns_no_data_when_no_valid_price_exists(monkeypatch):
    service = FinnhubDashboardService(api_key="demo", watchlist=("SPY",))

    def fail_quote(symbol: str):
        raise ExternalServiceError("quote failed")

    def fail_fallback(symbol: str):
        raise ExternalServiceError("fallback failed")

    monkeypatch.setattr(service, "_fetch_quote", fail_quote)
    monkeypatch.setattr(service, "_fallback_symbol_overview", fail_fallback)

    overview = service.get_symbol_overview("SPY", force_refresh=True)

    assert overview.symbol == "SPY"
    assert overview.price is None
    assert overview.no_data is True
    assert overview.data_quality == "NO_DATA"
