from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class AppUserPreference(Base):
    __tablename__ = "app_user_preferences"
    __table_args__ = (UniqueConstraint("app_user_id", name="uq_app_user_preferences_user_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    app_user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("app_users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    profile_language: Mapped[str] = mapped_column(String(16), nullable=False, default="English")
    default_strategy: Mapped[str] = mapped_column(String(16), nullable=False, default="simple")
    chart_timeframe: Mapped[str] = mapped_column(String(16), nullable=False, default="1D")
    chart_style: Mapped[str] = mapped_column(String(24), nullable=False, default="Candles")
    market_focus: Mapped[str] = mapped_column(String(64), nullable=False, default="US + Europe")
    market_timezone: Mapped[str] = mapped_column(String(64), nullable=False, default="Europe/Berlin")
    favorite_symbols: Mapped[Optional[str]] = mapped_column(Text, nullable=True, default="")
    favorites_only_alerts: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    alert_sensitivity: Mapped[str] = mapped_column(String(24), nullable=False, default="Balanced")
    quiet_hours: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    email_alerts: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    push_alerts: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    daily_digest: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    two_step_required: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    auto_logout_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    new_device_notify: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    legal_analytics: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    legal_personalized: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
