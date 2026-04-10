from __future__ import annotations

from datetime import datetime, timezone

from app.api.deps import RequestUserContext, get_request_user_context, get_user_alert_service
from app.models.app_user import AppUser
from app.models.user_notification import UserNotification
from app.schemas.analysis import AnalysisResponse
from app.schemas.user_alerts import AlertRuleCreate
from app.services.user_alerts import UserAlertService
from app.repositories.alert_rule import AlertRuleRepository
from app.repositories.user_notification import UserNotificationRepository


class StubAnalysisService:
    def __init__(self, responses: list[AnalysisResponse]) -> None:
        self.responses = list(responses)

    def analyze_symbol(self, symbol, force_refresh=False, strategy="hedgefund", db=None):
        if not self.responses:
            raise AssertionError("No more stub analysis responses configured.")
        return self.responses.pop(0)


def build_analysis(
    *,
    symbol: str,
    strategy: str,
    recommendation: str | None,
    confidence: float,
    data_quality: str = "FULL",
    no_data: bool = False,
    summary: str | None = None,
) -> AnalysisResponse:
    return AnalysisResponse(
        symbol=symbol,
        strategy=strategy,
        no_data=no_data,
        no_data_reason="No data." if no_data else None,
        recommendation=recommendation,
        signal_quality="FULL" if recommendation in {"BUY", "SELL"} else "PARTIAL",
        score=4 if recommendation == "BUY" else (-4 if recommendation == "SELL" else 0),
        probability_up=0.78,
        probability_down=0.22,
        confidence=confidence,
        risk_level="LOW",
        data_quality=data_quality,
        data_quality_reason="Synthetic test payload.",
        macro={
            "market_trend": "bullish",
            "interest_rate_effect": "neutral",
            "usd_strength": "neutral",
            "macro_score": 1,
        },
        no_trade=recommendation == "HOLD",
        no_trade_reason="No trade." if recommendation == "HOLD" else "",
        entry_signal=recommendation == "BUY",
        entry_reason="Entry signal active." if recommendation == "BUY" else "",
        exit_signal=recommendation == "SELL",
        exit_reason="Exit signal active." if recommendation == "SELL" else "",
        stop_loss_level=180.0,
        stop_loss_reason="Synthetic stop.",
        position_size_percent=10.0,
        position_size_reason="Synthetic sizing.",
        timeframe="short_term",
        warnings=[],
        summary=summary or f"{symbol} changed to {recommendation or 'NO_DATA'}.",
        generated_at=datetime.now(timezone.utc),
        signals=None,
        learning=None,
    )


def test_alert_rules_crud_and_notifications_are_user_scoped(client, db_session):
    user = AppUser(auth_subject="clerk|alerts-owner", provider="clerk", email="owner@example.com", name="Owner")
    db_session.add(user)
    db_session.commit()

    client.app.dependency_overrides[get_request_user_context] = lambda: RequestUserContext(
        user_key=user.auth_subject,
        app_user_id=user.id,
        is_authenticated=True,
        is_admin=False,
    )

    create_response = client.post(
        "/api/alert-rules",
        json={
            "symbol": "AAPL",
            "strategy": "hedgefund",
            "notify_on_buy": True,
            "notify_on_sell": True,
            "min_confidence": 67,
        },
    )
    assert create_response.status_code == 200
    rule = create_response.json()
    assert rule["user_id"] == user.id
    assert rule["symbol"] == "AAPL"
    assert rule["min_confidence"] == 67

    list_response = client.get("/api/alert-rules")
    assert list_response.status_code == 200
    listed = list_response.json()
    assert len(listed) == 1
    assert listed[0]["id"] == rule["id"]

    update_response = client.patch(
        f"/api/alert-rules/{rule['id']}",
        json={"enabled": False, "min_confidence": 72},
    )
    assert update_response.status_code == 200
    updated = update_response.json()
    assert updated["enabled"] is False
    assert updated["min_confidence"] == 72

    notification = UserNotification(
        user_id=user.id,
        alert_rule_id=rule["id"],
        symbol="AAPL",
        strategy="hedgefund",
        signal="BUY",
        confidence=81,
        title="AAPL signal changed to BUY",
        message="Synthetic notification",
    )
    db_session.add(notification)
    db_session.commit()

    notification_list = client.get("/api/notifications")
    assert notification_list.status_code == 200
    notifications = notification_list.json()
    assert len(notifications) == 1
    assert notifications[0]["status"] == "unread"

    mark_read = client.patch(f"/api/notifications/{notifications[0]['id']}/read")
    assert mark_read.status_code == 200
    assert mark_read.json()["status"] == "read"

    delete_response = client.delete(f"/api/alert-rules/{rule['id']}")
    assert delete_response.status_code == 200
    assert delete_response.json()["id"] == rule["id"]


def test_user_alert_scan_notifies_only_on_real_signal_change_and_skips_no_data(db_session):
    user = AppUser(auth_subject="clerk|scan-user", provider="clerk", email="scan@example.com", name="Scan User")
    db_session.add(user)
    db_session.commit()

    service = UserAlertService(
        analysis_service=StubAnalysisService(
            [
                build_analysis(symbol="AAPL", strategy="hedgefund", recommendation="BUY", confidence=82),
                build_analysis(symbol="AAPL", strategy="hedgefund", recommendation="BUY", confidence=84),
                build_analysis(symbol="AAPL", strategy="hedgefund", recommendation="HOLD", confidence=71),
                build_analysis(symbol="AAPL", strategy="hedgefund", recommendation="SELL", confidence=79),
                build_analysis(
                    symbol="AAPL",
                    strategy="hedgefund",
                    recommendation=None,
                    confidence=0,
                    data_quality="NO_DATA",
                    no_data=True,
                    summary="No data available.",
                ),
            ]
        ),
        alert_rule_repository=AlertRuleRepository(),
        notification_repository=UserNotificationRepository(),
    )

    rule = service.create_rule(
        db_session,
        user_id=user.id,
        payload=AlertRuleCreate(
            symbol="AAPL",
            strategy="hedgefund",
            enabled=True,
            notify_on_buy=True,
            notify_on_sell=True,
            min_confidence=60,
        ),
    )

    first = service.run_scan(db_session, force_refresh=True)
    second = service.run_scan(db_session, force_refresh=True)
    third = service.run_scan(db_session, force_refresh=True)
    fourth = service.run_scan(db_session, force_refresh=True)
    fifth = service.run_scan(db_session, force_refresh=True)

    assert first.baseline_seeded == 1
    assert first.notifications_created == 0
    assert second.notifications_created == 0
    assert third.notifications_created == 0
    assert fourth.notifications_created == 1
    assert fifth.notifications_created == 0
    assert fifth.skipped_no_data == 1

    notifications = UserNotificationRepository().list_for_user(db_session, user_id=user.id, limit=10)
    assert len(notifications) == 1
    assert notifications[0].signal == "SELL"

    refreshed_rule = AlertRuleRepository().get_for_user(db_session, user_id=user.id, rule_id=rule.id)
    assert refreshed_rule is not None
    assert refreshed_rule.last_evaluated_signal == "NO_DATA"
    assert refreshed_rule.last_notified_signal == "SELL"
