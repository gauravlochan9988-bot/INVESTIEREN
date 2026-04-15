from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


Strategy = Literal["simple", "ai", "hedgefund"]


class UserSettingsResponse(BaseModel):
    profile_language: str = "English"
    default_strategy: Strategy = "simple"
    chart_timeframe: str = "1D"
    chart_style: str = "Candles"
    market_focus: str = "US + Europe"
    market_timezone: str = "Europe/Berlin"
    favorite_symbols: list[str] = Field(default_factory=list)
    favorites_only_alerts: bool = False
    alert_sensitivity: str = "Balanced"
    quiet_hours: str = ""
    email_alerts: bool = True
    push_alerts: bool = True
    daily_digest: bool = False
    two_step_required: bool = True
    auto_logout_enabled: bool = True
    new_device_notify: bool = True
    legal_analytics: bool = True
    legal_personalized: bool = True
    updated_at: Optional[datetime] = None


class UserSettingsUpdateRequest(BaseModel):
    profile_language: str = "English"
    default_strategy: Strategy = "simple"
    chart_timeframe: str = "1D"
    chart_style: str = "Candles"
    market_focus: str = "US + Europe"
    market_timezone: str = "Europe/Berlin"
    favorite_symbols: list[str] = Field(default_factory=list)
    favorites_only_alerts: bool = False
    alert_sensitivity: str = "Balanced"
    quiet_hours: str = ""
    email_alerts: bool = True
    push_alerts: bool = True
    daily_digest: bool = False
    two_step_required: bool = True
    auto_logout_enabled: bool = True
    new_device_notify: bool = True
    legal_analytics: bool = True
    legal_personalized: bool = True
