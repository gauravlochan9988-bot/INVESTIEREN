from app.services.search import StockSearchService
from tests.helpers import FakeSearchProvider


def test_stock_search_service_limits_and_caches_results():
    provider = FakeSearchProvider()
    service = StockSearchService(provider=provider, ttl_seconds=3600)

    first = service.search("ap", limit=1)
    second = service.search("ap", limit=1)

    assert len(first) == 1
    assert first[0].symbol == "AAPL"
    assert second[0].name == "Apple Inc"
    assert provider.calls == 1


def test_stock_search_service_maps_common_index_queries():
    provider = FakeSearchProvider()
    service = StockSearchService(provider=provider, ttl_seconds=3600)

    results = service.search("S&P", limit=5)

    assert [result.symbol for result in results] == ["SPY", "VOO", "IVV"]


def test_stock_search_service_falls_back_to_simplified_query():
    provider = FakeSearchProvider()
    service = StockSearchService(provider=provider, ttl_seconds=3600)

    results = service.search("core ETF", limit=5)

    assert [result.symbol for result in results][:2] == ["IVV", "VTI"]
