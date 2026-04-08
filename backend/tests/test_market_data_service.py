import pytest
from datetime import datetime, timezone

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


def test_market_data_service_returns_stale_cache_when_provider_fails_after_warmup(
    market_data_service,
    fake_market_data_provider,
):
    class QuotesThenFailProvider:
        def __init__(self, base_provider):
            self.base_provider = base_provider
            self.fail = False

        def fetch_quotes(self, symbols, names):
            if self.fail:
                raise ExternalServiceError("provider down")
            return self.base_provider.fetch_quotes(symbols, names)

        def fetch_history(self, symbol, period):
            if self.fail:
                raise ExternalServiceError("provider down")
            return self.base_provider.fetch_history(symbol, period)

    provider = QuotesThenFailProvider(fake_market_data_provider)
    market_data_service.provider = provider

    warm_quotes = market_data_service.get_watchlist_quotes(force_refresh=True)
    warm_history = market_data_service.get_history("AAPL", "1mo", force_refresh=True)
    warm_quote = market_data_service.get_latest_quote("NFLX", force_refresh=True)

    provider.fail = True

    stale_watchlist = market_data_service.get_watchlist_quotes(force_refresh=True)
    stale_history = market_data_service.get_history("AAPL", "1mo", force_refresh=True)
    stale_quote = market_data_service.get_latest_quote("NFLX", force_refresh=True)

    assert [quote.symbol for quote in stale_watchlist] == [quote.symbol for quote in warm_quotes]
    assert all(quote.price > 0 for quote in stale_watchlist)
    assert stale_history == warm_history
    assert stale_quote.symbol == warm_quote.symbol
    assert stale_quote.price == warm_quote.price
    assert stale_quote.stale is True


class PartiallyFailingMarketDataProvider:
    def fetch_quotes(self, symbols, names):
        from datetime import datetime, timezone

        from app.services.market_data import QuoteSnapshot

        if len(symbols) == 1:
            raise ExternalServiceError("single symbol failed")

        snapshots = []
        for symbol in symbols:
            if symbol == "NVDA":
                continue
            snapshots.append(
                QuoteSnapshot(
                    symbol=symbol,
                    name=names[symbol],
                    price=100.0,
                    change_percent=1.5,
                    volume=1000,
                    updated_at=datetime.now(timezone.utc),
                )
            )
        return snapshots

    def fetch_history(self, symbol, period):
        from datetime import datetime, timedelta, timezone

        from app.schemas.stocks import HistoryPoint

        base = datetime.now(timezone.utc)
        return [
            HistoryPoint(date=base - timedelta(days=index), close=100.0 + index)
            for index in range(5)
        ]


def test_watchlist_quotes_skip_symbols_that_fail_to_parse_in_multi_symbol_requests():
    from app.services.market_data import MarketDataService

    service = MarketDataService(
        provider=PartiallyFailingMarketDataProvider(),
        allowed_symbols={
            "AAPL": "Apple",
            "MSFT": "Microsoft",
            "NVDA": "NVIDIA",
        },
        ttl_seconds=3600,
    )

    quotes = service.get_watchlist_quotes()

    assert [quote.symbol for quote in quotes] == ["AAPL", "MSFT"]


def test_composite_market_data_provider_falls_back_to_secondary_for_quotes():
    from app.services.market_data import (
        CompositeMarketDataProvider,
        MarketDataService,
        QuoteSnapshot,
    )

    class PrimaryFailingProvider:
        def fetch_quotes(self, symbols, names):
            raise ExternalServiceError("primary down")

        def fetch_history(self, symbol, period):
            raise ExternalServiceError("primary down")

    class SecondaryWorkingProvider:
        def fetch_quotes(self, symbols, names):
            return [
                QuoteSnapshot(
                    symbol="AMD",
                    name=names["AMD"],
                    price=166.45,
                    change_percent=1.12,
                    volume=123456,
                    updated_at=datetime.now(timezone.utc),
                )
            ]

        def fetch_history(self, symbol, period):
            raise ExternalServiceError("history not needed")

    service = MarketDataService(
        provider=CompositeMarketDataProvider(
            [PrimaryFailingProvider(), SecondaryWorkingProvider()],
            timeout_seconds=2.0,
        ),
        allowed_symbols={"AMD": "AMD"},
        ttl_seconds=3600,
    )

    quote = service.get_latest_quote("AMD", force_refresh=True)

    assert quote.symbol == "AMD"
    assert quote.price == 166.45
    assert quote.stale is False
