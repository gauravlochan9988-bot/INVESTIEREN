from __future__ import annotations

from dataclasses import asdict
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.alert_rule import AlertRule
from app.repositories.alert_rule import AlertRuleRepository
from app.repositories.favorite_symbol import FavoriteSymbolRepository
from app.repositories.user_notification import UserNotificationRepository
from app.services.alert_signal_eligibility import smart_alert_allowed
from app.schemas.analysis import AnalysisResponse
from app.schemas.user_alerts import AlertRuleCreate, AlertRuleUpdate, UserAlertScanSummary
from app.services.analysis import AnalysisService


class UserAlertService:
    def __init__(
        self,
        *,
        analysis_service: AnalysisService,
        alert_rule_repository: AlertRuleRepository,
        notification_repository: UserNotificationRepository,
        favorite_repository: FavoriteSymbolRepository,
    ) -> None:
        self.analysis_service = analysis_service
        self.alert_rule_repository = alert_rule_repository
        self.notification_repository = notification_repository
        self.favorite_repository = favorite_repository

    def list_rules(self, db: Session, *, user_id: int) -> list[AlertRule]:
        return self.alert_rule_repository.list_for_user(db, user_id=user_id)

    def create_rule(self, db: Session, *, user_id: int, payload: AlertRuleCreate) -> AlertRule:
        symbol = str(payload.symbol or "").strip().upper()
        return self.alert_rule_repository.create(
            db,
            user_id=user_id,
            symbol=symbol,
            strategy=payload.strategy,
            enabled=payload.enabled,
            notify_on_buy=payload.notify_on_buy,
            notify_on_sell=payload.notify_on_sell,
            min_confidence=float(payload.min_confidence),
        )

    def update_rule(self, db: Session, *, user_id: int, rule_id: int, payload: AlertRuleUpdate) -> AlertRule | None:
        rule = self.alert_rule_repository.get_for_user(db, user_id=user_id, rule_id=rule_id)
        if rule is None:
            return None
        values = payload.model_dump(exclude_unset=True, exclude_none=True)
        return self.alert_rule_repository.update(db, rule=rule, values=values)

    def delete_rule(self, db: Session, *, user_id: int, rule_id: int) -> AlertRule | None:
        rule = self.alert_rule_repository.get_for_user(db, user_id=user_id, rule_id=rule_id)
        if rule is None:
            return None
        self.alert_rule_repository.delete(db, rule=rule)
        return rule

    def list_notifications(self, db: Session, *, user_id: int, limit: int, unread_only: bool) -> list:
        return self.notification_repository.list_for_user(
            db,
            user_id=user_id,
            limit=limit,
            unread_only=unread_only,
        )

    def mark_notification_read(self, db: Session, *, user_id: int, notification_id: int):
        row = self.notification_repository.get_for_user(db, user_id=user_id, notification_id=notification_id)
        if row is None:
            return None
        return self.notification_repository.mark_read(db, notification=row)

    def mark_all_notifications_read(self, db: Session, *, user_id: int) -> int:
        return self.notification_repository.mark_all_read(db, user_id=user_id)

    def run_scan(
        self,
        db: Session,
        *,
        force_refresh: bool = True,
    ) -> UserAlertScanSummary:
        rules = self.alert_rule_repository.list_active(db)
        notifications_created = 0
        baseline_seeded = 0
        skipped_no_data = 0

        for rule in rules:
            created, seeded, skipped = self._process_rule(db, rule=rule, force_refresh=force_refresh)
            notifications_created += created
            baseline_seeded += seeded
            skipped_no_data += skipped

        db.commit()
        return UserAlertScanSummary(
            rules_scanned=len(rules),
            notifications_created=notifications_created,
            baseline_seeded=baseline_seeded,
            skipped_no_data=skipped_no_data,
        )

    def _process_rule(
        self,
        db: Session,
        *,
        rule: AlertRule,
        force_refresh: bool,
    ) -> tuple[int, int, int]:
        if self.favorite_repository.exists_for_app_user_symbol(
            db,
            app_user_id=rule.user_id,
            symbol=rule.symbol,
        ):
            return (0, 0, 0)

        analysis = self.analysis_service.analyze_symbol(
            rule.symbol,
            force_refresh=force_refresh,
            strategy=rule.strategy,
            db=db,
        )
        current_signal = self._signal_from_analysis(analysis)
        current_confidence = float(analysis.confidence or 0.0)
        previous_signal = rule.last_evaluated_signal

        if previous_signal is None:
            rule.last_evaluated_signal = current_signal
            return (0, 1, 1 if current_signal == "NO_DATA" else 0)

        if current_signal == "NO_DATA":
            rule.last_evaluated_signal = current_signal
            return (0, 0, 1)

        should_notify = (
            current_signal in {"BUY", "SELL"}
            and current_signal != previous_signal
            and smart_alert_allowed(
                analysis,
                rule=rule,
                default_partial_min=float(rule.min_confidence or 0.0),
            )
        )

        created = 0
        if should_notify:
            self.notification_repository.create(
                db,
                user_id=rule.user_id,
                alert_rule_id=rule.id,
                symbol=rule.symbol,
                strategy=rule.strategy,
                signal=current_signal,
                confidence=current_confidence,
                title=f"{rule.symbol} signal changed to {current_signal}",
                message=self._notification_message(rule.symbol, analysis, current_signal, current_confidence),
                commit=False,
            )
            rule.last_notified_signal = current_signal
            rule.last_notified_at = datetime.now(timezone.utc)
            created = 1

        rule.last_evaluated_signal = current_signal
        return (created, 0, 0)

    @staticmethod
    def _signal_from_analysis(analysis: AnalysisResponse) -> str:
        if analysis.no_data or analysis.data_quality == "NO_DATA" or analysis.recommendation is None:
            return "NO_DATA"
        return analysis.recommendation

    @staticmethod
    def _notification_message(symbol: str, analysis: AnalysisResponse, signal: str, confidence: float) -> str:
        reason = (analysis.summary or analysis.reason or "Signal changed.").strip()
        return (
            f"{symbol} changed to {signal} with {int(round(confidence))}% confidence. "
            f"{reason}"
        )
