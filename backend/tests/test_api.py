from sqlalchemy import select

from datetime import date, datetime, timezone

from app.api.deps import get_analysis_service
from app.core.exceptions import ExternalServiceError
from app.models.alert_event import AlertEvent
from app.models.analysis_log import AnalysisLog
from app.models.trade_performance_log import TradePerformanceLog
from app.repositories.analysis_log import AnalysisLogRepository
from app.repositories.analysis_threshold import AnalysisThresholdRepository
from app.schemas.analysis import AnalysisResponse
from app.services.analysis import AnalysisService
from app.services.analysis_calibration import AnalysisCalibrationService
from app.services.macro import MacroContextService
from app.services.market_data import MarketDataService
from app.services.news import NewsSentimentService
from app.services.strategy_learning import LEARNING_LAYER_VERSION
from tests.helpers import FakeMarketDataProvider, FakeNewsProvider, FakeSummaryService


class FailingMarketDataProvider:
    def fetch_quotes(self, symbols, names):
        raise ExternalServiceError("Provider error while loading quotes.")

    def fetch_history(self, symbol, period):
        raise ExternalServiceError("Live market data provider is currently unavailable.")


class ShortHistoryMarketDataProvider:
    def fetch_quotes(self, symbols, names):
        raise ExternalServiceError("Quotes are not needed for this test.")

    def fetch_history(self, symbol, period):
        from tests.helpers import build_history

        return build_history(start=100.0, drift=0.4)[:40]


class StubAnalysisService:
    def __init__(self, responses):
        self.responses = list(responses)

    def analyze_symbol(self, symbol, force_refresh=False, strategy="hedgefund", db=None):
        return self.responses.pop(0)


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


def test_search_endpoint_supports_open_direct_symbol_lookup(client):
    response = client.get("/api/search", params={"q": "SXR8.DE"})

    assert response.status_code == 200
    payload = response.json()
    assert payload[0]["symbol"] == "SXR8.DE"
    assert "direct symbol lookup" in payload[0]["name"].lower()


def test_search_universe_endpoint_returns_full_known_catalog(client):
    response = client.get("/api/search/universe")

    assert response.status_code == 200
    payload = response.json()
    assert len(payload) >= 100
    symbols = {item["symbol"] for item in payload}
    assert {"AAPL", "KO", "SPY", "COIN"}.issubset(symbols)


def test_analyze_endpoint_returns_decision_payload(client):
    response = client.post("/api/analyze", json={"symbol": "AAPL", "strategy": "hedgefund"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["symbol"] == "AAPL"
    assert payload["strategy"] == "hedgefund"
    assert payload["no_data"] is False
    assert payload["no_data_reason"] is None
    assert payload["recommendation"] in {"BUY", "HOLD", "SELL"}
    assert payload["signal_quality"] in {"FULL", "PARTIAL"}
    assert isinstance(payload["decision_label"], str)
    assert isinstance(payload["score"], int)
    assert -5 <= payload["score"] <= 5
    assert payload["data_quality"] in {"FULL", "PARTIAL", "NO_DATA"}
    assert isinstance(payload["data_quality_reason"], str)
    assert payload["data_quality_reason"]
    assert payload["risk"] == payload["risk_level"]
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
    response = client.post("/api/analyze", json={"symbol": "NFLX", "strategy": "simple"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["symbol"] == "NFLX"
    assert payload["strategy"] == "simple"
    assert payload["no_data"] is False
    assert payload["recommendation"] in {"BUY", "HOLD", "SELL"}


def test_analysis_get_endpoint_returns_nested_signal_block(client):
    response = client.get("/api/analysis/AAPL", params={"strategy": "ai"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["symbol"] == "AAPL"
    assert payload["strategy"] == "ai"
    assert payload["no_data"] is False
    assert payload["recommendation"] in {"BUY", "HOLD", "SELL"}
    assert payload["signal_quality"] in {"FULL", "PARTIAL"}
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

    response = client.post("/api/analyze", json={"symbol": "AAPL", "strategy": "simple"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["symbol"] == "AAPL"
    assert payload["strategy"] == "simple"
    assert payload["no_data"] is True
    assert payload["no_data_reason"] == "No live market data available."
    assert payload["data_quality"] == "NO_DATA"
    assert payload["data_quality_reason"] == "No live market data available."
    assert payload["confidence"] == 0.0
    assert payload["recommendation"] is None
    assert payload["signal_quality"] is None
    assert payload["signals"] is None


def test_analyze_endpoint_returns_partial_when_only_short_history_exists(client):
    analysis_service = AnalysisService(
        market_data_service=MarketDataService(
            provider=ShortHistoryMarketDataProvider(),
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

    response = client.post("/api/analyze", json={"symbol": "AAPL", "strategy": "simple"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["no_data"] is True
    assert payload["data_quality"] == "NO_DATA"
    assert "Not enough market history" in payload["data_quality_reason"]
    assert payload["confidence"] == 0.0


def test_analyze_endpoint_returns_structured_no_data_for_invalid_symbol(client):
    response = client.post("/api/analyze", json={"symbol": "BMW!", "strategy": "ai"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["symbol"] == "BMW!"
    assert payload["strategy"] == "ai"
    assert payload["no_data"] is True
    assert payload["recommendation"] is None
    assert payload["signal_quality"] is None
    assert payload["confidence"] == 0.0
    assert payload["data_quality"] == "NO_DATA"
    assert payload["data_quality_reason"] == "No sufficient data available."
    assert payload["reason"] == "No sufficient data available."


def test_strategy_query_returns_selected_strategy_without_frontend_overrides(client):
    simple = client.get("/api/analysis/MSFT", params={"strategy": "simple"})
    ai = client.get("/api/analysis/MSFT", params={"strategy": "ai"})
    hedgefund = client.get("/api/analysis/MSFT", params={"strategy": "hedgefund"})

    assert simple.status_code == 200
    assert ai.status_code == 200
    assert hedgefund.status_code == 200

    simple_payload = simple.json()
    ai_payload = ai.json()
    hedgefund_payload = hedgefund.json()

    assert simple_payload["strategy"] == "simple"
    assert ai_payload["strategy"] == "ai"
    assert hedgefund_payload["strategy"] == "hedgefund"
    assert simple_payload["recommendation"] == "HOLD"
    assert ai_payload["recommendation"] == "BUY"
    assert hedgefund_payload["recommendation"] == "HOLD"
    assert simple_payload["decision_label"] == "HOLD"
    assert ai_payload["decision_label"] == "BUY FULL"
    assert hedgefund_payload["decision_label"] == "HOLD"
    assert simple_payload["data_quality"] == "FULL"
    assert ai_payload["data_quality"] == "FULL"
    assert hedgefund_payload["data_quality"] == "FULL"


def test_analysis_endpoint_logs_each_analysis_to_database(client, db_session):
    response = client.get("/api/analysis/AAPL", params={"strategy": "ai"})

    assert response.status_code == 200
    rows = db_session.query(AnalysisLog).all()
    assert len(rows) == 1
    row = rows[0]
    payload = response.json()
    assert row.symbol == "AAPL"
    assert row.strategy == "ai"
    assert row.score == payload["score"]
    assert row.recommendation == payload["recommendation"]
    assert row.data_quality == payload["data_quality"]
    assert row.confidence == payload["confidence"]


def test_analysis_stats_route_returns_distribution_per_strategy(client):
    client.get("/api/analysis/AAPL", params={"strategy": "simple"})
    client.get("/api/analysis/MSFT", params={"strategy": "simple"})
    client.get("/api/analysis/TSLA", params={"strategy": "ai"})
    client.get("/api/analysis/AAPL", params={"strategy": "hedgefund"})

    response = client.get("/api/analysis/stats")

    assert response.status_code == 200
    payload = response.json()
    strategies = {item["strategy"]: item for item in payload["strategies"]}
    assert {"simple", "ai", "hedgefund"}.issubset(strategies)
    assert strategies["simple"]["total"] == 2
    assert strategies["ai"]["total"] == 1
    assert strategies["hedgefund"]["total"] == 1
    for item in strategies.values():
        assert set(item["thresholds"]) == {"buy_threshold", "sell_threshold", "updated_at"}
        total_percent = round(
            item["buy_percent"] + item["sell_percent"] + item["hold_percent"], 1
        )
        assert total_percent in {0.0, 100.0}


def test_analysis_performance_route_returns_strategy_learning_metrics(client, db_session):
    for index in range(55):
        db_session.add(
            TradePerformanceLog(
                symbol=f"AI{index}",
                strategy="ai",
                learning_version=LEARNING_LAYER_VERSION,
                quantity=1,
                entry_price=100.0,
                exit_price=112.0,
                recommendation="BUY",
                score=3,
                confidence=74.0,
                data_quality="FULL",
                profit_loss=12.0,
                duration=8.0,
                opened_at=date(2025, 1, 1),
                closed_at=datetime(2025, 3, 1, tzinfo=timezone.utc),
            )
        )
    db_session.commit()

    response = client.get("/api/analysis/performance")

    assert response.status_code == 200
    payload = response.json()
    assert payload["version"] == LEARNING_LAYER_VERSION
    strategies = {item["strategy"]: item for item in payload["strategies"]}
    ai = strategies["ai"]
    assert ai["eligible"] is True
    assert ai["trade_count"] == 55
    assert ai["win_rate"] == 1.0
    assert ai["average_profit_loss"] == 12.0
    assert ai["drawdown"] == 0.0
    assert ai["buy_accuracy"] == 1.0
    assert ai["sell_error_rate"] == 0.0
    assert ai["directional_bias"] > 0.0
    assert ai["confidence_bias"] == 10.0
    assert ai["weak_signal_multiplier"] == 1.0
    assert ai["thresholds"]["buy_threshold"] == 1.5
    assert ai["thresholds"]["sell_threshold"] == -1.5
    assert ai["effective_thresholds"]["buy_threshold"] == 1.5
    assert ai["effective_thresholds"]["sell_threshold"] == -1.5
    assert ai["adjustment_count"] >= 1
    assert set(ai["thresholds"]) == {"buy_threshold", "sell_threshold", "updated_at"}
    assert set(ai["effective_thresholds"]) == {"buy_threshold", "sell_threshold", "updated_at"}


def test_healthcheck_exposes_active_database_status(client):
    response = client.get("/api/health")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert "database" in payload
    assert payload["database"]["backend"] == "sqlite"
    assert payload["database"]["mode"] == "primary"
    assert payload["database"]["fallback_active"] is False
    assert payload["database"]["healthy"] is True


def test_alerts_endpoint_returns_live_signal_events(client):
    response = client.get("/api/alerts", params={"strategy": "simple", "limit": 6})

    assert response.status_code == 200
    payload = response.json()
    assert payload
    assert any(item["title"] == "AAPL is now BUY" for item in payload)
    assert any(item["kind"] == "rsi" for item in payload)
    assert all(item["strategy"] == "simple" for item in payload)


def test_alerts_are_persisted_and_can_be_filtered_to_favorites(client, db_session):
    favorite_response = client.post(
        "/api/favorites",
        json={"symbol": "AAPL", "user_key": "desk"},
    )
    assert favorite_response.status_code == 200
    assert favorite_response.json() == {"symbol": "AAPL", "user_key": "desk"}

    alerts_response = client.get(
        "/api/alerts",
        params={
            "strategy": "simple",
            "user_key": "desk",
            "favorites_only": True,
            "limit": 6,
        },
    )

    assert alerts_response.status_code == 200
    payload = alerts_response.json()
    assert payload
    assert all(item["symbol"] == "AAPL" for item in payload)
    assert all(item["is_favorite"] is True for item in payload)

    saved = list(db_session.scalars(select(AlertEvent)).all())
    assert saved
    assert any(row.symbol == "AAPL" and row.user_key == "desk" for row in saved)


def test_favorites_can_be_listed_and_deleted(client):
    client.post("/api/favorites", json={"symbol": "AAPL", "user_key": "desk"})

    list_response = client.get("/api/favorites", params={"user_key": "desk"})
    assert list_response.status_code == 200
    assert list_response.json() == [{"symbol": "AAPL", "user_key": "desk"}]

    delete_response = client.delete("/api/favorites/AAPL", params={"user_key": "desk"})
    assert delete_response.status_code == 200
    assert delete_response.json() == {"symbol": "AAPL", "user_key": "desk"}

    final_list = client.get("/api/favorites", params={"user_key": "desk"})
    assert final_list.status_code == 200
    assert final_list.json() == []


def test_buy_opens_trade_and_sell_closes_trade(client, db_session):
    base = datetime(2025, 4, 1, tzinfo=timezone.utc)
    stub_service = StubAnalysisService(
        [
            AnalysisResponse(
                symbol="AAPL",
                strategy="simple",
                no_data=False,
                recommendation="BUY",
                signal_quality="FULL",
                score=3,
                probability_up=0.72,
                probability_down=0.28,
                confidence=71.0,
                risk_level="LOW",
                data_quality="FULL",
                data_quality_reason="Full data quality.",
                macro=None,
                no_trade=False,
                no_trade_reason="Trade evaluation available.",
                entry_signal=True,
                entry_reason="Entry confirmed.",
                exit_signal=False,
                exit_reason="No exit.",
                stop_loss_level=150.0,
                stop_loss_reason="Use support.",
                position_size_percent=12.0,
                position_size_reason="Measured size.",
                timeframe="mid_term",
                warnings=[],
                summary="BUY because trend is aligned.",
                generated_at=base,
                signals=None,
                learning=None,
            ),
            AnalysisResponse(
                symbol="AAPL",
                strategy="simple",
                no_data=False,
                recommendation="SELL",
                signal_quality="FULL",
                score=-3,
                probability_up=0.28,
                probability_down=0.72,
                confidence=74.0,
                risk_level="LOW",
                data_quality="FULL",
                data_quality_reason="Full data quality.",
                macro=None,
                no_trade=False,
                no_trade_reason="Trade evaluation available.",
                entry_signal=False,
                entry_reason="No entry.",
                exit_signal=True,
                exit_reason="Exit confirmed on sell signal.",
                stop_loss_level=148.0,
                stop_loss_reason="Exit signal overrides stop.",
                position_size_percent=0.0,
                position_size_reason="No size.",
                timeframe="mid_term",
                warnings=[],
                summary="SELL because momentum has broken down.",
                generated_at=base.replace(hour=1),
                signals=None,
                learning=None,
            ),
        ]
    )
    client.app.dependency_overrides[get_analysis_service] = lambda: stub_service

    buy_response = client.get("/api/analysis/AAPL", params={"strategy": "simple"})
    assert buy_response.status_code == 200

    rows_after_buy = list(db_session.scalars(select(TradePerformanceLog)).all())
    assert len(rows_after_buy) == 1
    assert rows_after_buy[0].recommendation == "BUY"
    assert rows_after_buy[0].profit_loss is None
    assert rows_after_buy[0].exit_price is None

    sell_response = client.get("/api/analysis/AAPL", params={"strategy": "simple"})
    assert sell_response.status_code == 200

    rows_after_sell = list(db_session.scalars(select(TradePerformanceLog)).all())
    assert len(rows_after_sell) == 1
    assert rows_after_sell[0].recommendation == "BUY"
    assert rows_after_sell[0].profit_loss is not None
    assert rows_after_sell[0].exit_price is not None

    trade_history = client.get("/api/portfolio/trades").json()
    assert len(trade_history) == 1
    assert trade_history[0]["recommendation"] == "BUY"
    assert trade_history[0]["profit_loss"] is not None

    client.app.dependency_overrides.pop(get_analysis_service, None)


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


def test_close_position_logs_realized_trade_metrics(client, sample_position_payload):
    create_response = client.post("/api/portfolio/positions", json=sample_position_payload)
    created = create_response.json()

    client.get("/api/analysis/AAPL", params={"strategy": "ai"})

    close_response = client.post(
        f"/api/portfolio/positions/{created['id']}/close",
        json={
            "strategy": "ai",
            "exit_price": 170.0,
            "closed_at": "2025-02-01T00:00:00Z",
        },
    )

    assert close_response.status_code == 200
    payload = close_response.json()
    assert payload["strategy"] == "ai"
    assert payload["learning_version"] == LEARNING_LAYER_VERSION
    assert payload["entry_price"] == 155.5
    assert payload["exit_price"] == 170.0
    assert payload["recommendation"] in {"BUY", "SELL", "HOLD"}
    assert payload["score"] is not None
    assert payload["confidence"] is not None
    assert payload["data_quality"] in {"FULL", "PARTIAL", "NO_DATA"}
    assert payload["profit_loss"] == 43.5
    assert payload["duration"] == 17.0

    portfolio_snapshot = client.get("/api/portfolio").json()
    assert portfolio_snapshot["positions"] == []

    trade_history = client.get("/api/portfolio/trades").json()
    assert len(trade_history) == 1
    assert trade_history[0]["symbol"] == "AAPL"
    assert trade_history[0]["recommendation"] == payload["recommendation"]
    assert trade_history[0]["profit_loss"] == 43.5


def test_error_payload_uses_consistent_error_shape(client):
    response = client.get("/api/stocks/ZZZZ/history?range=1mo")

    assert response.status_code == 404
    assert "error" in response.json()


def test_calibration_service_syncs_saved_strategy_thresholds(
    db_session,
    analysis_service,
):
    threshold_repository = AnalysisThresholdRepository()
    calibration_service = AnalysisCalibrationService(
        analysis_log_repository=AnalysisLogRepository(),
        analysis_threshold_repository=threshold_repository,
        analysis_service=analysis_service,
        minimum_samples=1,
        tolerance_percent=0.0,
        max_adjustment_step=0.5,
    )
    threshold_repository.save(
        db_session,
        strategy="simple",
        buy_threshold=2.5,
        sell_threshold=-2.5,
    )

    thresholds = calibration_service.recalibrate_strategy(db_session, "simple")

    assert thresholds.buy_threshold == 2.5
    assert thresholds.sell_threshold == -2.5

    stats = calibration_service.get_distribution_stats(db_session)
    simple = next(item for item in stats.strategies if item.strategy == "simple")
    assert simple.thresholds.buy_threshold == 2.5
    assert simple.thresholds.sell_threshold == -2.5
