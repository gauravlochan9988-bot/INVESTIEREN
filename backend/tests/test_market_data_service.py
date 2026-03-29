import pytest

from app.core.exceptions import ExternalServiceError, ValidationError


class FailingMarketDataProvider:
    def fetch_quotes(self, symbols, names):
        raise ExternalServiceError("provider down")

    def fetch_history(self, symbol, period):
        raise ExternalServiceError("provider down")


def test_watchlist_quotes_are_cached(market_data_service, fake_market_data_provider):
    first = market_data_service.get_watchlist_quotes()
    second = market_data_service.get_watchlist_quotes()

    assert first == second
    assert fake_market_data_provider.quote_calls == 1


def test_history_lookup_is_cached(market_data_service, fake_market_data_provider):
    market_data_service.get_history("AAPL", "1mo")
    market_data_service.get_history("AAPL", "1mo")

    assert fake_market_data_provider.history_calls == 1


def test_force_refresh_bypasses_market_cache(market_data_service, fake_market_data_provider):
    market_data_service.get_watchlist_quotes()
    market_data_service.get_watchlist_quotes(force_refresh=True)
    market_data_service.get_history("AAPL", "1mo")
    market_data_service.get_history("AAPL", "1mo", force_refresh=True)

    assert fake_market_data_provider.quote_calls == 2
    assert fake_market_data_provider.history_calls == 2


def test_invalid_symbol_raises_validation_error(market_data_service):
    with pytest.raises(ValidationError):
        market_data_service.get_history("BAD!", "1mo")


def test_market_data_service_supports_symbol_outside_watchlist(market_data_service):
    history = market_data_service.get_history("NFLX", "1mo")
    quote = market_data_service.get_latest_quote("NFLX")

    assert len(history) == 120
    assert quote.symbol == "NFLX"


def test_market_data_service_supports_yahoo_suffix_symbols(market_data_service):
    history = market_data_service.get_history("SAP.DE", "1mo")
    quote = market_data_service.get_latest_quote("RELIANCE.NS")

    assert len(history) == 120
    assert history[-1].close > 0
    assert quote.symbol == "RELIANCE.NS"


def test_market_data_service_raises_live_data_error_when_provider_fails():
    from app.services.market_data import MarketDataService

    service = MarketDataService(
        provider=FailingMarketDataProvider(),
        allowed_symbols={
            "AAPL": "Apple",
            "MSFT": "Microsoft",
            "TSLA": "Tesla",
            "NVDA": "NVIDIA",
            "AMZN": "Amazon",
        },
        ttl_seconds=3600,
    )

    with pytest.raises(ExternalServiceError, match="No live market data available"):
        service.get_watchlist_quotes()

    with pytest.raises(ExternalServiceError, match="No live market data available"):
        service.get_history("AAPL", "1mo")

    with pytest.raises(ExternalServiceError, match="No live market data available"):
        service.get_latest_quote("NFLX")
