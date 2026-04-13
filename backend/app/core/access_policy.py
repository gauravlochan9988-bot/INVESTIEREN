from __future__ import annotations

from fastapi import HTTPException, status

# Free-plan product limits (single source of truth)
FREE_MAX_FAVORITES = 5
FREE_DAILY_ANALYSES = 20


def has_pro_access(user_context) -> bool:
    return bool(
        user_context
        and (
            getattr(user_context, "is_admin", False)
            or getattr(user_context, "role", "") == "owner"
            or getattr(user_context, "plan", "") == "pro"
        )
    )


def raise_feature_locked(feature: str, message: str) -> None:
    raise HTTPException(
        status_code=status.HTTP_402_PAYMENT_REQUIRED,
        detail={
            "code": "feature_locked",
            "feature": feature,
            "message": message,
            "upgrade_required": True,
        },
    )


def raise_quota_reached(feature: str, *, limit: int, window: str, message: str) -> None:
    raise HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail={
            "code": "quota_reached",
            "feature": feature,
            "limit": limit,
            "window": window,
            "message": message,
            "upgrade_required": True,
        },
    )
