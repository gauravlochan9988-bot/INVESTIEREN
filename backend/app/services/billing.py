from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Optional

import stripe
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.models.app_user import AppUser
from app.repositories.app_subscription import AppSubscriptionRepository


class BillingService:
    def __init__(
        self,
        *,
        settings: Settings,
        subscription_repository: AppSubscriptionRepository,
    ) -> None:
        self.settings = settings
        self.subscription_repository = subscription_repository
        self.secret_key = settings.stripe_secret_key.strip()
        self.webhook_secret = settings.stripe_webhook_secret.strip()
        if self.secret_key:
            stripe.api_key = self.secret_key

    @property
    def enabled(self) -> bool:
        return bool(self.secret_key)

    def _ensure_enabled(self) -> None:
        if not self.enabled:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Stripe billing is not configured.",
            )

    def _frontend_url(self, suffix: str) -> str:
        return f"{self.settings.frontend_origin.rstrip('/')}{suffix}"

    def _checkout_line_items(self) -> list[dict[str, Any]]:
        if self.settings.stripe_price_id.strip():
            return [{"price": self.settings.stripe_price_id.strip(), "quantity": 1}]
        return [
            {
                "price_data": {
                    "currency": "eur",
                    "unit_amount": 999,
                    "recurring": {"interval": "month"},
                    "product_data": {"name": "Investieren Pro Monthly"},
                },
                "quantity": 1,
            }
        ]

    def _period_end(self, unix_value: Optional[int]) -> Optional[datetime]:
        if not unix_value:
            return None
        return datetime.fromtimestamp(unix_value, tz=timezone.utc)

    def get_or_create_customer_id(self, db: Session, *, app_user: AppUser) -> Optional[str]:
        subscription = self.subscription_repository.get_by_user_id(db, app_user_id=app_user.id)
        if subscription and subscription.stripe_customer_id:
            return subscription.stripe_customer_id
        return None

    def create_checkout_session(self, db: Session, *, app_user: AppUser) -> Dict[str, str]:
        self._ensure_enabled()

        customer = self.get_or_create_customer_id(db, app_user=app_user)
        session = stripe.checkout.Session.create(
            mode="subscription",
            success_url=self._frontend_url("/?checkout=success&session_id={CHECKOUT_SESSION_ID}"),
            cancel_url=self._frontend_url("/?checkout=cancel"),
            line_items=self._checkout_line_items(),
            allow_promotion_codes=True,
            customer=customer,
            customer_email=None if customer else app_user.email,
            metadata={
                "app_user_id": str(app_user.id),
                "auth_subject": app_user.auth_subject,
            },
        )

        self.subscription_repository.upsert_for_user(
            db,
            app_user_id=app_user.id,
            auth_subject=app_user.auth_subject,
            stripe_customer_id=session.get("customer"),
            stripe_checkout_session_id=session["id"],
            status="checkout_pending",
        )

        return {"url": session["url"], "session_id": session["id"]}

    def sync_checkout_session(self, db: Session, *, app_user: AppUser, session_id: str) -> Dict[str, Any]:
        self._ensure_enabled()
        session = stripe.checkout.Session.retrieve(session_id, expand=["subscription"])
        subscription = session.get("subscription")
        stripe_customer_id = session.get("customer")

        if hasattr(subscription, "get"):
            status_value = subscription.get("status", "active")
            stripe_subscription_id = subscription.get("id")
            current_period_end = self._period_end(subscription.get("current_period_end"))
            cancel_at_period_end = bool(subscription.get("cancel_at_period_end", False))
        else:
            status_value = "active"
            stripe_subscription_id = None
            current_period_end = None
            cancel_at_period_end = False

        row = self.subscription_repository.upsert_for_user(
            db,
            app_user_id=app_user.id,
            auth_subject=app_user.auth_subject,
            stripe_customer_id=stripe_customer_id,
            stripe_subscription_id=stripe_subscription_id,
            stripe_checkout_session_id=session_id,
            status=status_value,
            current_period_end=current_period_end,
            cancel_at_period_end=cancel_at_period_end,
        )
        return {
            "status": "ok",
            "subscription_status": row.status,
        }

    def get_subscription_status(self, db: Session, *, app_user_id: int) -> Dict[str, Any]:
        row = self.subscription_repository.get_by_user_id(db, app_user_id=app_user_id)
        if row is None:
            return {
                "active": False,
                "status": "inactive",
                "plan_name": "Investieren Pro Monthly",
                "amount_cents": 999,
                "currency": "eur",
                "interval": "month",
                "cancel_at_period_end": False,
                "current_period_end": None,
            }
        return {
            "active": row.status in {"active", "trialing"},
            "status": row.status,
            "plan_name": row.plan_name,
            "amount_cents": row.amount_cents,
            "currency": row.currency,
            "interval": row.interval,
            "cancel_at_period_end": row.cancel_at_period_end,
            "current_period_end": row.current_period_end,
        }

    def handle_webhook(self, db: Session, *, payload: bytes, signature: Optional[str]) -> Dict[str, str]:
        self._ensure_enabled()
        if not self.webhook_secret:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Stripe webhook secret is not configured.",
            )
        try:
            event = stripe.Webhook.construct_event(payload, signature, self.webhook_secret)
        except Exception as exc:  # pragma: no cover - Stripe signature handling
            raise HTTPException(status_code=400, detail=f"Invalid webhook: {exc}") from exc

        event_type = event.get("type")
        data = (event.get("data") or {}).get("object") or {}

        if event_type == "checkout.session.completed":
            metadata = data.get("metadata") or {}
            app_user_id = int(metadata.get("app_user_id") or 0)
            auth_subject = str(metadata.get("auth_subject") or "").strip()
            subscription_id = data.get("subscription")
            customer_id = data.get("customer")
            if app_user_id and auth_subject:
                self.subscription_repository.upsert_for_user(
                    db,
                    app_user_id=app_user_id,
                    auth_subject=auth_subject,
                    stripe_customer_id=customer_id,
                    stripe_subscription_id=subscription_id,
                    stripe_checkout_session_id=data.get("id"),
                    status="active",
                )
        elif event_type in {"customer.subscription.updated", "customer.subscription.deleted", "customer.subscription.created"}:
            self.subscription_repository.mark_from_subscription(
                db,
                stripe_subscription_id=str(data.get("id") or ""),
                status=str(data.get("status") or "inactive"),
                cancel_at_period_end=bool(data.get("cancel_at_period_end", False)),
                current_period_end=self._period_end(data.get("current_period_end")),
                stripe_customer_id=data.get("customer"),
            )

        return {"status": "ok"}
