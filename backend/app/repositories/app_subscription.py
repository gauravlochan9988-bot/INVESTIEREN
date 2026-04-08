from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.app_subscription import AppSubscription


class AppSubscriptionRepository:
    def get_by_user_id(self, db: Session, *, app_user_id: int) -> Optional[AppSubscription]:
        return db.scalar(select(AppSubscription).where(AppSubscription.app_user_id == app_user_id))

    def get_by_auth_subject(self, db: Session, *, auth_subject: str) -> Optional[AppSubscription]:
        return db.scalar(select(AppSubscription).where(AppSubscription.auth_subject == auth_subject))

    def get_by_checkout_session_id(self, db: Session, *, checkout_session_id: str) -> Optional[AppSubscription]:
        return db.scalar(
            select(AppSubscription).where(AppSubscription.stripe_checkout_session_id == checkout_session_id)
        )

    def get_by_subscription_id(self, db: Session, *, stripe_subscription_id: str) -> Optional[AppSubscription]:
        return db.scalar(
            select(AppSubscription).where(AppSubscription.stripe_subscription_id == stripe_subscription_id)
        )

    def upsert_for_user(
        self,
        db: Session,
        *,
        app_user_id: int,
        auth_subject: str,
        stripe_customer_id: Optional[str] = None,
        stripe_subscription_id: Optional[str] = None,
        stripe_checkout_session_id: Optional[str] = None,
        status: str = "inactive",
        plan_name: str = "Investieren Pro Monthly",
        amount_cents: int = 499,
        currency: str = "eur",
        interval: str = "month",
        cancel_at_period_end: bool = False,
        current_period_end: Optional[datetime] = None,
    ) -> AppSubscription:
        row = self.get_by_user_id(db, app_user_id=app_user_id)
        if row is None:
            row = AppSubscription(app_user_id=app_user_id, auth_subject=auth_subject)
            db.add(row)

        row.auth_subject = auth_subject
        if stripe_customer_id:
            row.stripe_customer_id = stripe_customer_id
        if stripe_subscription_id:
            row.stripe_subscription_id = stripe_subscription_id
        if stripe_checkout_session_id:
            row.stripe_checkout_session_id = stripe_checkout_session_id
        row.status = status
        row.plan_name = plan_name
        row.amount_cents = amount_cents
        row.currency = currency
        row.interval = interval
        row.cancel_at_period_end = cancel_at_period_end
        row.current_period_end = current_period_end

        db.commit()
        db.refresh(row)
        return row

    def mark_from_subscription(
        self,
        db: Session,
        *,
        stripe_subscription_id: str,
        status: str,
        cancel_at_period_end: bool,
        current_period_end: Optional[datetime],
        stripe_customer_id: Optional[str] = None,
    ) -> Optional[AppSubscription]:
        row = self.get_by_subscription_id(db, stripe_subscription_id=stripe_subscription_id)
        if row is None:
            return None
        row.status = status
        row.cancel_at_period_end = cancel_at_period_end
        row.current_period_end = current_period_end
        if stripe_customer_id:
            row.stripe_customer_id = stripe_customer_id
        row.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(row)
        return row
