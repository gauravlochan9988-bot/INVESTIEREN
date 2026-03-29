from app.services.search import StockSearchService
from app.services.search_catalog import DEFAULT_SEARCH_CATALOG
from tests.helpers import FakeSearchProvider


def test_stock_search_service_limits_and_caches_remote_results():
    provider = FakeSearchProvider()
    service = StockSearchService(provider=provider, catalog_entries=(), ttl_seconds=3600)

    first = service.search("ap", limit=1)
    second = service.search("ap", limit=1)

    assert len(first) == 1
    assert first == second
    assert first[0].symbol == "AAPL"
    assert provider.calls == 1


def test_stock_search_service_matches_symbol_and_name_from_local_catalog():
    provider = FakeSearchProvider()
    service = StockSearchService(provider=provider, ttl_seconds=3600)

    results = service.search("co", limit=5)

    symbols = [result.symbol for result in results]
    assert "KO" in symbols[:3]
    assert "COIN" in symbols[:3]


def test_stock_search_service_maps_common_index_queries():
    provider = FakeSearchProvider()
    service = StockSearchService(provider=provider, ttl_seconds=3600)

    results = service.search("SP", limit=5)

    assert [result.symbol for result in results[:3]] == ["SPY", "VOO", "IVV"]


def test_stock_search_service_falls_back_to_simplified_query():
    provider = FakeSearchProvider()
    service = StockSearchService(provider=provider, ttl_seconds=3600)

    results = service.search("core ETF", limit=5)

    assert [result.symbol for result in results[:3]] == ["IVV", "VTI", "VXUS"]


def test_search_catalog_has_broad_coverage():
    assert len(DEFAULT_SEARCH_CATALOG) >= 100
