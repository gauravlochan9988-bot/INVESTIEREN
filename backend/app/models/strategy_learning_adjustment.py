from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class StrategyLearningAdjustment(Base):
    __tablename__ = "strategy_learning_adjustments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    strategy: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    learning_version: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    trade_count: Mapped[int] = mapped_column(Integer, nullable=False)
    win_rate: Mapped[float] = mapped_column(Float, nullable=False)
    average_profit_loss: Mapped[float] = mapped_column(Float, nullable=False)
    average_profit: Mapped[float] = mapped_column(Float, nullable=False)
    average_loss: Mapped[float] = mapped_column(Float, nullable=False)
    buy_accuracy: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    sell_error_rate: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    confidence_bias: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    directional_bias: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    weak_signal_multiplier: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)
    buy_threshold_offset: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    sell_threshold_offset: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    note: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
