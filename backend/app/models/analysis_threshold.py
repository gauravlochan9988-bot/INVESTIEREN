from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Float, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class AnalysisThreshold(Base):
    __tablename__ = "analysis_thresholds"

    strategy: Mapped[str] = mapped_column(String(16), primary_key=True)
    buy_threshold: Mapped[float] = mapped_column(Float, nullable=False, default=3.0)
    sell_threshold: Mapped[float] = mapped_column(Float, nullable=False, default=-3.0)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
