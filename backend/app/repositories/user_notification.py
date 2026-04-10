from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.models.user_notification import UserNotification


class UserNotificationRepository:
    def list_for_user(
        self,
        db: Session,
        *,
        user_id: int,
        limit: int,
        unread_only: bool = False,
    ) -> list[UserNotification]:
        statement = (
            select(UserNotification)
            .where(UserNotification.user_id == user_id)
            .order_by(UserNotification.created_at.desc(), UserNotification.id.desc())
            .limit(limit)
        )
        if unread_only:
            statement = statement.where(UserNotification.status == "unread")
        return list(db.scalars(statement).all())

    def create(
        self,
        db: Session,
        *,
        user_id: int,
        alert_rule_id: int | None,
        symbol: str,
        strategy: str,
        signal: str,
        confidence: float,
        title: str,
        message: str,
        commit: bool = True,
    ) -> UserNotification:
        row = UserNotification(
            user_id=user_id,
            alert_rule_id=alert_rule_id,
            symbol=symbol,
            strategy=strategy,
            signal=signal,
            confidence=confidence,
            title=title,
            message=message,
            status="unread",
        )
        db.add(row)
        if commit:
            db.commit()
            db.refresh(row)
        return row

    def get_for_user(self, db: Session, *, user_id: int, notification_id: int) -> UserNotification | None:
        statement = select(UserNotification).where(
            UserNotification.id == notification_id,
            UserNotification.user_id == user_id,
        )
        return db.scalar(statement)

    def mark_read(self, db: Session, *, notification: UserNotification) -> UserNotification:
        notification.status = "read"
        notification.read_at = notification.read_at or datetime.now(timezone.utc)
        db.commit()
        db.refresh(notification)
        return notification

    def mark_all_read(self, db: Session, *, user_id: int) -> int:
        now = datetime.now(timezone.utc)
        result = db.execute(
            update(UserNotification)
            .where(UserNotification.user_id == user_id, UserNotification.status == "unread")
            .values(status="read", read_at=now)
        )
        db.commit()
        return int(result.rowcount or 0)
