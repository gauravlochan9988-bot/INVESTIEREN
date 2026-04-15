from __future__ import annotations

from sqlalchemy.orm import Session

from app.core.config import Settings
from app.repositories.app_subscription import AppSubscriptionRepository
from app.repositories.app_user import AppUserRepository
from app.schemas.admin_access import AdminUserAccessLookupResponse


class AdminAccessService:
    def __init__(
        self,
        *,
        settings: Settings,
        app_user_repository: AppUserRepository,
        subscription_repository: AppSubscriptionRepository,
    ) -> None:
        self.settings = settings
        self.app_user_repository = app_user_repository
        self.subscription_repository = subscription_repository

    def lookup_user(self, db: Session, *, email: str) -> AdminUserAccessLookupResponse:
        normalized_email = (email or "").strip().lower()
        user = self.app_user_repository.get_by_email(db, email=normalized_email)
        if user is None:
            return AdminUserAccessLookupResponse(
                found=False,
                email=normalized_email,
                message="User not found. The user must log in once before access can be managed.",
            )

        return self._serialize_user(db, user=user)

    def grant_pro(self, db: Session, *, email: str) -> AdminUserAccessLookupResponse:
        user = self._require_existing_user(db, email=email)
        self.subscription_repository.upsert_for_user(
            db,
            app_user_id=user.id,
            auth_subject=user.auth_subject,
            status="active",
            plan_name="Investieren Pro Monthly",
            amount_cents=499,
            currency="eur",
            interval="month",
            cancel_at_period_end=False,
            current_period_end=None,
        )
        return self._serialize_user(db, user=user)

    def revoke_pro(self, db: Session, *, email: str) -> AdminUserAccessLookupResponse:
        user = self._require_existing_user(db, email=email)
        self.subscription_repository.upsert_for_user(
            db,
            app_user_id=user.id,
            auth_subject=user.auth_subject,
            status="inactive",
            plan_name="Investieren Pro Monthly",
            amount_cents=499,
            currency="eur",
            interval="month",
            cancel_at_period_end=False,
            current_period_end=None,
        )
        return self._serialize_user(db, user=user)

    def _require_existing_user(self, db: Session, *, email: str):
        normalized_email = (email or "").strip().lower()
        user = self.app_user_repository.get_by_email(db, email=normalized_email)
        if user is None:
            raise ValueError("User not found. The user must log in once before access can be managed.")
        return user

    def _serialize_user(self, db: Session, *, user) -> AdminUserAccessLookupResponse:
        owner_subjects = set(self.settings.get_owner_subjects())
        owner_emails = set(self.settings.get_owner_emails())
        subscription = self.subscription_repository.get_by_user_id(db, app_user_id=user.id)

        user_email = (user.email or "").strip().lower()
        role = "owner" if (user.auth_subject in owner_subjects or (user_email and user_email in owner_emails)) else "user"
        plan = "pro" if role == "owner" else "free"
        subscription_status = subscription.status if subscription else "inactive"

        if role != "owner" and subscription and subscription.status in {"active", "trialing"}:
            plan = "pro"

        return AdminUserAccessLookupResponse(
            found=True,
            email=(user.email or "").strip().lower(),
            app_user_id=user.id,
            auth_subject=user.auth_subject,
            name=user.name,
            role=role,
            plan=plan,
            subscription_status=subscription_status,
        )
