from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Float, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class AlertState(Base):
    __tablename__ = "alert_states"
    __table_args__ = (
        UniqueConstraint("user_key", "symbol", "strategy", name="uq_alert_state_user_symbol_strategy"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_key: Mapped[str] = mapped_column(String(64), index=True, nullable=False, default="default")
    symbol: Mapped[str] = mapped_column(String(16), index=True, nullable=False)
    strategy: Mapped[str] = mapped_column(String(16), index=True, nullable=False)
    last_price: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    last_recommendation: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    last_data_quality: Mapped[str] = mapped_column(String(16), nullable=False, default="NO_DATA")
    last_confidence: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    is_favorite: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
        index=True,
    )
