from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from sqlalchemy import Date, DateTime, Float, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class TradePerformanceLog(Base):
    __tablename__ = "trade_performance_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    symbol: Mapped[str] = mapped_column(String(16), index=True, nullable=False)
    strategy: Mapped[str] = mapped_column(String(16), index=True, nullable=False)
    learning_version: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    quantity: Mapped[float] = mapped_column(Float, nullable=False)
    entry_price: Mapped[float] = mapped_column(Float, nullable=False)
    exit_price: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    recommendation: Mapped[Optional[str]] = mapped_column(String(16), nullable=True, index=True)
    score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    confidence: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    data_quality: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    profit_loss: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    duration: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    opened_at: Mapped[date] = mapped_column(Date, nullable=False)
    closed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
