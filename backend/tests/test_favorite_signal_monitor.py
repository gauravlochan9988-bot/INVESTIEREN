from __future__ import annotations

from datetime import datetime, timezone

import pytest
from sqlalchemy import select

from app.api.deps import get_favorite_signal_monitor_service
from app.core.config import get_settings
from app.models.alert_event import AlertEvent
from app.models.alert_state import AlertState
from app.repositories.alert_repository import AlertRepository
from app.repositories.alert_rule import AlertRuleRepository
from app.repositories.favorite_symbol import FavoriteSymbolRepository
from app.repositories.user_notification import UserNotificationRepository
from app.schemas.analysis import AnalysisResponse
from app.services.alert_signal_eligibility import eligible_for_buy_sell_notification
from app.services.favorite_signal_monitor import (
    FavoriteSignalMonitorService,
    FavoriteSignalScanSummary,
)
from app.services.market_data import MarketDataService
from tests.conftest import FakeMarketDataProvider


def _base_response(**kwargs) -> AnalysisResponse:
    base = datetime(2025, 4, 1, tzinfo=timezone.utc)
    defaults: dict = {
        "symbol": "AAPL",
        "strategy": "hedgefund",
        "no_data": False,
        "recommendation": "HOLD",
        "signal_quality": "FULL",
        "score": 0,
        "probability_up": 0.5,
        "probability_down": 0.5,
        "confidence": 55.0,
        "risk_level": "MEDIUM",
        "data_quality": "FULL",
        "data_quality_reason": "ok",
        "macro": None,
        "no_trade": False,
        "no_trade_reason": "",
        "entry_signal": False,
        "entry_reason": "",
        "exit_signal": False,
        "exit_reason": "",
        "stop_loss_level": None,
        "stop_loss_reason": "",
        "position_size_percent": None,
        "position_size_reason": "",
        "timeframe": "mid_term",
        "warnings": [],
        "summary": "hold",
        "generated_at": base,
        "signals": None,
        "learning": None,
    }
    defaults.update(kwargs)
    return AnalysisResponse(**defaults)


class SequenceAnalysisStub:
    def __init__(self, responses: list[AnalysisResponse]) -> None:
        self._responses = list(responses)

    def analyze_symbol(self, symbol, force_refresh=False, strategy="hedgefund", db=None):
        return self._responses.pop(0)


@pytest.fixture
def market_for_monitor(fake_market_data_provider: FakeMarketDataProvider) -> MarketDataService:
    return MarketDataService(
        provider=fake_market_data_provider,
        allowed_symbols={"AAPL": "Apple"},
        ttl_seconds=3600,
    )


def test_eligible_full_buy():
    a = _base_response(recommendation="BUY", data_quality="FULL", signal_quality="FULL", confidence=80.0)
    assert eligible_for_buy_sell_notification(a, min_confidence_partial=58.0) is True


def test_eligible_partial_below_threshold():
    a = _base_response(
        recommendation="BUY",
        data_quality="PARTIAL",
        signal_quality="FULL",
        confidence=40.0,
    )
    assert eligible_for_buy_sell_notification(a, min_confidence_partial=58.0) is False


def test_eligible_partial_at_threshold():
    a = _base_response(
        recommendation="BUY",
        data_quality="PARTIAL",
        signal_quality="FULL",
        confidence=58.0,
    )
    assert eligible_for_buy_sell_notification(a, min_confidence_partial=58.0) is True


def test_eligible_no_trade_blocked():
    a = _base_response(recommendation="BUY", no_trade=True)
    assert eligible_for_buy_sell_notification(a, min_confidence_partial=58.0) is False


def test_baseline_then_buy_creates_one_event(db_session, market_for_monitor: MarketDataService):
    fav = FavoriteSymbolRepository()
    fav.create(db_session, user_key="user-a", symbol="AAPL")
    stub = SequenceAnalysisStub(
        [
            _base_response(recommendation="HOLD"),
            _base_response(recommendation="BUY", confidence=72.0),
        ]
    )
    monitor = FavoriteSignalMonitorService(
        analysis_service=stub,
        market_data_service=market_for_monitor,
        alert_repository=AlertRepository(),
        favorite_repository=fav,
        alert_rule_repository=AlertRuleRepository(),
        notification_repository=UserNotificationRepository(),
        min_confidence_partial=58.0,
    )
    s1 = monitor.run_scan(db_session, strategy="hedgefund", force_refresh=True)
    assert s1.events_created == 0
    assert s1.baseline_seeded == 1

    s2 = monitor.run_scan(db_session, strategy="hedgefund", force_refresh=True)
    assert s2.events_created == 1
    assert s2.baseline_seeded == 0

    events = list(db_session.scalars(select(AlertEvent)).all())
    assert len(events) == 1
    assert events[0].kind == "favorite_signal"
    assert events[0].recommendation == "BUY"


def test_buy_to_buy_no_second_event(db_session, market_for_monitor: MarketDataService):
    fav = FavoriteSymbolRepository()
    fav.create(db_session, user_key="user-a", symbol="AAPL")
    stub = SequenceAnalysisStub(
        [
            _base_response(recommendation="BUY", confidence=80.0),
            _base_response(recommendation="BUY", confidence=82.0),
        ]
    )
    monitor = FavoriteSignalMonitorService(
        analysis_service=stub,
        market_data_service=market_for_monitor,
        alert_repository=AlertRepository(),
        favorite_repository=fav,
        alert_rule_repository=AlertRuleRepository(),
        notification_repository=UserNotificationRepository(),
        min_confidence_partial=58.0,
    )
    monitor.run_scan(db_session, strategy="hedgefund", force_refresh=True)
    monitor.run_scan(db_session, strategy="hedgefund", force_refresh=True)
    events = list(db_session.scalars(select(AlertEvent)).all())
    assert len(events) == 0


def test_no_data_does_not_seed_state(db_session, market_for_monitor: MarketDataService):
    fav = FavoriteSymbolRepository()
    fav.create(db_session, user_key="user-a", symbol="AAPL")
    stub = SequenceAnalysisStub(
        [
            _base_response(
                no_data=True,
                data_quality="NO_DATA",
                data_quality_reason="missing",
                recommendation=None,
            ),
        ]
    )
    monitor = FavoriteSignalMonitorService(
        analysis_service=stub,
        market_data_service=market_for_monitor,
        alert_repository=AlertRepository(),
        favorite_repository=fav,
        alert_rule_repository=AlertRuleRepository(),
        notification_repository=UserNotificationRepository(),
        min_confidence_partial=58.0,
    )
    summary = monitor.run_scan(db_session, strategy="hedgefund", force_refresh=True)
    assert summary.skipped_no_data == 1
    states = list(db_session.scalars(select(AlertState)).all())
    assert len(states) == 0


def test_list_distinct_user_keys(db_session):
    fav = FavoriteSymbolRepository()
    fav.create(db_session, user_key="z-user", symbol="AAPL")
    fav.create(db_session, user_key="a-user", symbol="MSFT")
    fav.create(db_session, user_key="a-user", symbol="NVDA")
    keys = fav.list_distinct_user_keys(db_session)
    assert keys == ["a-user", "z-user"]


def test_cron_endpoint_auth(client, monkeypatch):
    class StubMonitor:
        def run_scan(self, db, *, strategy, force_refresh=True):
            return FavoriteSignalScanSummary(0, 0, 0, 0, 0)

    monkeypatch.setenv("CRON_SECRET", "good-secret")
    get_settings.cache_clear()
    try:
        client.app.dependency_overrides[get_favorite_signal_monitor_service] = lambda: StubMonitor()
        assert client.post("/api/internal/cron/favorite-signals").status_code == 401
        assert (
            client.post(
                "/api/internal/cron/favorite-signals",
                headers={"X-Cron-Secret": "wrong"},
            ).status_code
            == 401
        )
        ok = client.post(
            "/api/internal/cron/favorite-signals",
            headers={"X-Cron-Secret": "good-secret"},
        )
        assert ok.status_code == 200
        assert ok.json()["events_created"] == 0
    finally:
        client.app.dependency_overrides.pop(get_favorite_signal_monitor_service, None)
        get_settings.cache_clear()
