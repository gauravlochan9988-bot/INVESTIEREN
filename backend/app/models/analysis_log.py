from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Float, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class AnalysisLog(Base):
    __tablename__ = "analysis_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    symbol: Mapped[str] = mapped_column(String(16), index=True, nullable=False)
    strategy: Mapped[str] = mapped_column(String(16), index=True, nullable=False)
    score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    recommendation: Mapped[Optional[str]] = mapped_column(String(16), index=True, nullable=True)
    data_quality: Mapped[str] = mapped_column(String(16), index=True, nullable=False)
    confidence: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
