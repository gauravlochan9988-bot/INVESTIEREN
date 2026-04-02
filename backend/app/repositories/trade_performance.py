from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.trade_performance_log import TradePerformanceLog


class TradePerformanceRepository:
    def create(
        self, db: Session, entry: TradePerformanceLog, *, commit: bool = True
    ) -> TradePerformanceLog:
        db.add(entry)
        if commit:
            db.commit()
            db.refresh(entry)
        return entry

    def list_entries(
        self,
        db: Session,
        *,
        strategy: str | None = None,
        limit: int | None = None,
    ) -> list[TradePerformanceLog]:
        statement = select(TradePerformanceLog).order_by(
            TradePerformanceLog.closed_at.asc(), TradePerformanceLog.id.asc()
        )
        if strategy:
            statement = statement.where(TradePerformanceLog.strategy == strategy)
        rows = list(db.scalars(statement).all())
        if limit is not None and limit >= 0:
            return rows[-limit:]
        return rows
