from app.api.deps import get_analysis_service
from app.core.exceptions import ExternalServiceError
from app.services.analysis import AnalysisService
from app.services.macro import MacroContextService
from app.services.market_data import MarketDataService
from app.services.news import NewsSentimentService
from tests.helpers import FakeMarketDataProvider, FakeNewsProvider, FakeSummaryService


class FailingMarketDataProvider:
    def fetch_quotes(self, symbols, names):
        raise ExternalServiceError("Provider error while loading quotes.")

    def fetch_history(self, symbol, period):
        raise ExternalServiceError("Live market data provider is currently unavailable.")


def test_stocks_endpoint_returns_watchlist(client):
    response = client.get("/api/stocks")

    assert response.status_code == 200
    payload = response.json()
    assert [stock["symbol"] for stock in payload] == ["AAPL", "MSFT", "TSLA", "NVDA", "AMZN"]


def test_refresh_query_params_are_accepted_by_data_endpoints(client):
    stocks_response = client.get("/api/stocks", params={"refresh": True})
    analysis_response = client.post("/api/analyze?refresh=true", json={"symbol": "AAPL"})
    portfolio_response = client.get("/api/portfolio", params={"refresh": True})

    assert stocks_response.status_code == 200
    assert analysis_response.status_code == 200
    assert portfolio_response.status_code == 200


def test_search_endpoint_returns_global_symbol_results(client):
    response = client.get("/api/search", params={"q": "ap"})

    assert response.status_code == 200
    payload = response.json()
    symbols = [item["symbol"] for item in payload[:3]]
    assert "AAPL" in symbols
    assert "APD" in symbols


def test_search_endpoint_matches_companies_outside_watchlist(client):
    response = client.get("/api/search", params={"q": "co"})

    assert response.status_code == 200
    payload = response.json()
    symbols = [item["symbol"] for item in payload[:3]]
    assert "KO" in symbols
    assert "COIN" in symbols


def test_search_endpoint_surfaces_index_etfs_from_partial_query(client):
    response = client.get("/api/search", params={"q": "sp"})

    assert response.status_code == 200
    payload = response.json()
    assert [item["symbol"] for item in payload[:3]] == ["SPY", "VOO", "IVV"]


def test_search_universe_endpoint_returns_full_known_catalog(client):
    response = client.get("/api/search/universe")

    assert response.status_code == 200
    payload = response.json()
    assert len(payload) >= 100
    symbols = {item["symbol"] for item in payload}
    assert {"AAPL", "KO", "SPY", "COIN"}.issubset(symbols)


def test_analyze_endpoint_returns_decision_payload(client):
    response = client.post("/api/analyze", json={"symbol": "AAPL"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["symbol"] == "AAPL"
    assert payload["no_data"] is False
    assert payload["no_data_reason"] is None
    assert payload["recommendation"] in {"BUY", "HOLD", "SELL"}
    assert 0 <= payload["probability_up"] <= 1
    assert 0 <= payload["probability_down"] <= 1
    assert isinstance(payload["warnings"], list)
    assert set(payload["macro"]) == {
        "market_trend",
        "interest_rate_effect",
        "usd_strength",
        "macro_score",
    }
    assert isinstance(payload["no_trade"], bool)
    assert isinstance(payload["no_trade_reason"], str)
    assert isinstance(payload["entry_signal"], bool)
    assert isinstance(payload["exit_signal"], bool)
    assert isinstance(payload["stop_loss_level"], float)
    assert isinstance(payload["position_size_percent"], float)
    assert payload["timeframe"] in {"short_term", "mid_term", "unclear"}
    assert isinstance(payload["summary"], str)
    assert payload["summary"]
    assert payload["reason"] == payload["summary"]
    assert payload["summary"].startswith(payload["recommendation"])
    assert set(payload["signals"]) == {
        "trend",
        "sma_crossover",
        "rsi",
        "momentum",
        "volatility",
        "news_sentiment",
        "trend_strength",
    }


def test_analyze_endpoint_accepts_symbol_outside_watchlist(client):
    response = client.post("/api/analyze", json={"symbol": "NFLX"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["symbol"] == "NFLX"
    assert payload["no_data"] is False
    assert payload["recommendation"] in {"BUY", "HOLD", "SELL"}


def test_analysis_get_endpoint_returns_nested_signal_block(client):
    response = client.get("/api/analysis/AAPL")

    assert response.status_code == 200
    payload = response.json()
    assert payload["symbol"] == "AAPL"
    assert payload["no_data"] is False
    assert payload["recommendation"] in {"BUY", "HOLD", "SELL"}
    assert "no_trade" in payload
    assert "no_trade_reason" in payload
    assert "entry_reason" in payload
    assert "exit_reason" in payload
    assert "stop_loss_reason" in payload
    assert "position_size_reason" in payload
    assert payload["macro"]["market_trend"] in {"bullish", "neutral", "bearish"}
    assert payload["macro"]["interest_rate_effect"] in {"positive", "neutral", "negative"}
    assert payload["macro"]["usd_strength"] in {"weak", "neutral", "strong"}
    assert payload["signals"]["news_sentiment"]["name"] == "News Sentiment"
    assert payload["signals"]["trend_strength"]["name"] == "Trend Strength"


def test_analyze_endpoint_returns_no_data_status_when_live_market_data_is_missing(client):
    analysis_service = AnalysisService(
        market_data_service=MarketDataService(
            provider=FailingMarketDataProvider(),
            allowed_symbols={"AAPL": "Apple"},
            ttl_seconds=3600,
        ),
        macro_context_service=MacroContextService(
            provider=FakeMarketDataProvider(),
            ttl_seconds=3600,
            market_symbol="SPY",
            usd_symbol="DXY",
            interest_rate_effect="neutral",
        ),
        news_sentiment_service=NewsSentimentService(
            provider=FakeNewsProvider(),
            ttl_seconds=3600,
            headline_limit=8,
        ),
        summary_service=FakeSummaryService(),
    )
    client.app.dependency_overrides[get_analysis_service] = lambda: analysis_service

    response = client.post("/api/analyze", json={"symbol": "AAPL"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["symbol"] == "AAPL"
    assert payload["no_data"] is True
    assert payload["no_data_reason"] == "No live market data available."
    assert payload["recommendation"] is None
    assert payload["signals"] is None


def test_portfolio_crud_flow(client, sample_position_payload):
    create_response = client.post("/api/portfolio/positions", json=sample_position_payload)

    assert create_response.status_code == 201
    created = create_response.json()
    assert created["symbol"] == "AAPL"
    assert created["market_value"] > 0

    get_response = client.get("/api/portfolio")
    assert get_response.status_code == 200
    snapshot = get_response.json()
    assert snapshot["cost_basis"] == round(3 * 155.5, 2)
    assert len(snapshot["positions"]) == 1

    patch_response = client.patch(
        f"/api/portfolio/positions/{created['id']}",
        json={"quantity": 5, "average_price": 150.0},
    )
    assert patch_response.status_code == 200
    updated = patch_response.json()
    assert updated["quantity"] == 5
    assert updated["average_price"] == 150.0

    delete_response = client.delete(f"/api/portfolio/positions/{created['id']}")
    assert delete_response.status_code == 204

    final_snapshot = client.get("/api/portfolio").json()
    assert final_snapshot["positions"] == []
    assert final_snapshot["market_value"] == 0.0


def test_error_payload_uses_consistent_error_shape(client):
    response = client.get("/api/stocks/ZZZZ/history?range=1mo")

    assert response.status_code == 404
    assert "error" in response.json()
