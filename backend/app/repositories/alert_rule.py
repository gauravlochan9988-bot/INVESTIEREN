from __future__ import annotations

from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models.alert_rule import AlertRule


class AlertRuleRepository:
    def list_for_user(self, db: Session, *, user_id: int) -> list[AlertRule]:
        statement = (
            select(AlertRule)
            .where(AlertRule.user_id == user_id)
            .order_by(AlertRule.created_at.asc(), AlertRule.id.asc())
        )
        return list(db.scalars(statement).all())

    def list_active(self, db: Session) -> list[AlertRule]:
        statement = (
            select(AlertRule)
            .where(AlertRule.enabled.is_(True))
            .order_by(AlertRule.user_id.asc(), AlertRule.symbol.asc(), AlertRule.id.asc())
        )
        return list(db.scalars(statement).all())

    def get_for_user(self, db: Session, *, user_id: int, rule_id: int) -> AlertRule | None:
        statement = select(AlertRule).where(AlertRule.id == rule_id, AlertRule.user_id == user_id)
        return db.scalar(statement)

    def get_by_user_symbol_strategy(
        self,
        db: Session,
        *,
        user_id: int,
        symbol: str,
        strategy: str,
    ) -> AlertRule | None:
        statement = select(AlertRule).where(
            AlertRule.user_id == user_id,
            AlertRule.symbol == symbol,
            AlertRule.strategy == strategy,
        )
        return db.scalar(statement)

    def delete_all_for_user_symbol(self, db: Session, *, user_id: int, symbol: str) -> int:
        result = db.execute(
            delete(AlertRule).where(AlertRule.user_id == user_id, AlertRule.symbol == symbol)
        )
        db.commit()
        return int(result.rowcount or 0)

    def create(
        self,
        db: Session,
        *,
        user_id: int,
        symbol: str,
        strategy: str,
        enabled: bool,
        notify_on_buy: bool,
        notify_on_sell: bool,
        min_confidence: float,
    ) -> AlertRule:
        existing = db.scalar(
            select(AlertRule).where(
                AlertRule.user_id == user_id,
                AlertRule.symbol == symbol,
                AlertRule.strategy == strategy,
            )
        )
        if existing is not None:
            existing.enabled = enabled
            existing.notify_on_buy = notify_on_buy
            existing.notify_on_sell = notify_on_sell
            existing.min_confidence = min_confidence
            db.commit()
            db.refresh(existing)
            return existing

        row = AlertRule(
            user_id=user_id,
            symbol=symbol,
            strategy=strategy,
            enabled=enabled,
            notify_on_buy=notify_on_buy,
            notify_on_sell=notify_on_sell,
            min_confidence=min_confidence,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        return row

    def update(
        self,
        db: Session,
        *,
        rule: AlertRule,
        values: dict[str, Any],
    ) -> AlertRule:
        for key, value in values.items():
            setattr(rule, key, value)
        db.commit()
        db.refresh(rule)
        return rule

    def delete(self, db: Session, *, rule: AlertRule) -> None:
        db.delete(rule)
        db.commit()
