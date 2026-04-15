from __future__ import annotations

import argparse
import sys

from sqlalchemy import func, select

from app.core.database import get_session_factory
from app.models.app_user import AppUser
from app.repositories.app_subscription import AppSubscriptionRepository


def grant_pro_access(email: str) -> int:
    normalized_email = (email or "").strip().lower()
    if not normalized_email:
        print("Error: email is required.", file=sys.stderr)
        return 1

    session = get_session_factory()()
    try:
        user = session.scalar(select(AppUser).where(func.lower(AppUser.email) == normalized_email))
        if user is None:
            print(
                f"User with email '{normalized_email}' was not found. The user must log in once before Pro can be granted.",
                file=sys.stderr,
            )
            return 1

        repository = AppSubscriptionRepository()
        subscription = repository.upsert_for_user(
            session,
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

        print(
            f"Pro access granted to {normalized_email} "
            f"(app_user_id={user.id}, subscription_status={subscription.status})."
        )
        return 0
    finally:
        session.close()


def main() -> int:
    parser = argparse.ArgumentParser(description="Grant Pro access to an existing user by email.")
    parser.add_argument("email", help="User email address")
    args = parser.parse_args()
    return grant_pro_access(args.email)


if __name__ == "__main__":
    raise SystemExit(main())
