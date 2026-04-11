from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import (
    RequestUserContext,
    get_app_user_preference_repository,
    require_authenticated_user_context,
)
from app.core.database import get_db
from app.repositories.app_user_preference import AppUserPreferenceRepository
from app.schemas.settings import UserSettingsResponse, UserSettingsUpdateRequest

router = APIRouter(prefix="/settings", tags=["settings"])


def _normalize_symbol_list(values: list[str]) -> list[str]:
    normalized: list[str] = []
    for item in values:
        symbol = str(item or "").strip().upper()
        if not symbol:
            continue
        if symbol not in normalized:
            normalized.append(symbol)
    return normalized[:64]


def _serialize_preferences(row) -> UserSettingsResponse:
    symbols = _normalize_symbol_list((row.favorite_symbols or "").split(","))
    return UserSettingsResponse(
        profile_language=row.profile_language or "English",
        default_strategy=row.default_strategy or "simple",
        chart_timeframe=row.chart_timeframe or "1D",
        chart_style=row.chart_style or "Candles",
        market_focus=row.market_focus or "US + Europe",
        market_timezone=row.market_timezone or "Europe/Berlin",
        favorite_symbols=symbols,
        favorites_only_alerts=bool(row.favorites_only_alerts),
        alert_sensitivity=row.alert_sensitivity or "Balanced",
        quiet_hours=row.quiet_hours or "",
        email_alerts=bool(row.email_alerts),
        push_alerts=bool(row.push_alerts),
        daily_digest=bool(row.daily_digest),
        two_step_required=bool(row.two_step_required),
        auto_logout_enabled=bool(row.auto_logout_enabled),
        new_device_notify=bool(row.new_device_notify),
        legal_analytics=bool(row.legal_analytics),
        legal_personalized=bool(row.legal_personalized),
        updated_at=row.updated_at,
    )


@router.get("/me", response_model=UserSettingsResponse)
def get_my_settings(
    db: Session = Depends(get_db),
    user_context: RequestUserContext = Depends(require_authenticated_user_context),
    preference_repository: AppUserPreferenceRepository = Depends(get_app_user_preference_repository),
) -> UserSettingsResponse:
    app_user_id = int(user_context.app_user_id)
    row = preference_repository.upsert_for_user(db, app_user_id=app_user_id)
    return _serialize_preferences(row)


@router.patch("/me", response_model=UserSettingsResponse)
def update_my_settings(
    payload: UserSettingsUpdateRequest,
    db: Session = Depends(get_db),
    user_context: RequestUserContext = Depends(require_authenticated_user_context),
    preference_repository: AppUserPreferenceRepository = Depends(get_app_user_preference_repository),
) -> UserSettingsResponse:
    app_user_id = int(user_context.app_user_id)
    selected_strategy = payload.default_strategy
    if selected_strategy in {"ai", "hedgefund"} and not (
        user_context.is_admin or user_context.role == "owner" or user_context.plan == "pro"
    ):
        selected_strategy = "simple"

    favorite_symbols = _normalize_symbol_list(payload.favorite_symbols)
    updates = {
        "profile_language": str(payload.profile_language or "English").strip() or "English",
        "default_strategy": selected_strategy,
        "chart_timeframe": str(payload.chart_timeframe or "1D").strip() or "1D",
        "chart_style": str(payload.chart_style or "Candles").strip() or "Candles",
        "market_focus": str(payload.market_focus or "US + Europe").strip() or "US + Europe",
        "market_timezone": str(payload.market_timezone or "Europe/Berlin").strip() or "Europe/Berlin",
        "favorite_symbols": ",".join(favorite_symbols),
        "favorites_only_alerts": bool(payload.favorites_only_alerts),
        "alert_sensitivity": str(payload.alert_sensitivity or "Balanced").strip() or "Balanced",
        "quiet_hours": str(payload.quiet_hours or "").strip(),
        "email_alerts": bool(payload.email_alerts),
        "push_alerts": bool(payload.push_alerts),
        "daily_digest": bool(payload.daily_digest),
        "two_step_required": bool(payload.two_step_required),
        "auto_logout_enabled": bool(payload.auto_logout_enabled),
        "new_device_notify": bool(payload.new_device_notify),
        "legal_analytics": bool(payload.legal_analytics),
        "legal_personalized": bool(payload.legal_personalized),
    }
    row = preference_repository.upsert_for_user(
        db,
        app_user_id=app_user_id,
        updates=updates,
    )
    return _serialize_preferences(row)
