from __future__ import annotations

from datetime import datetime, time, timezone

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

    def get_open_trade(
        self,
        db: Session,
        *,
        symbol: str,
        strategy: str,
    ) -> TradePerformanceLog | None:
        statement = (
            select(TradePerformanceLog)
            .where(
                TradePerformanceLog.symbol == symbol,
                TradePerformanceLog.strategy == strategy,
                TradePerformanceLog.profit_loss.is_(None),
            )
            .order_by(TradePerformanceLog.created_at.desc(), TradePerformanceLog.id.desc())
            .limit(1)
        )
        return db.scalar(statement)

    def close_trade(
        self,
        db: Session,
        *,
        trade: TradePerformanceLog,
        exit_price: float,
        closed_at: datetime,
        commit: bool = True,
    ) -> TradePerformanceLog:
        if closed_at.tzinfo is None:
            closed_at = closed_at.replace(tzinfo=timezone.utc)
        opened_at_datetime = datetime.combine(trade.opened_at, time.min, tzinfo=timezone.utc)
        trade.exit_price = exit_price
        trade.closed_at = closed_at
        trade.duration = round(
            max((closed_at - opened_at_datetime).total_seconds(), 0.0) / 86_400,
            2,
        )
        direction = 1.0 if (trade.recommendation or "").upper() == "BUY" else -1.0
        trade.profit_loss = round((exit_price - trade.entry_price) * trade.quantity * direction, 2)
        if commit:
            db.commit()
            db.refresh(trade)
        return trade

    def list_entries(
        self,
        db: Session,
        *,
        strategy: str | None = None,
        limit: int | None = None,
        include_open: bool = False,
    ) -> list[TradePerformanceLog]:
        statement = select(TradePerformanceLog).order_by(
            TradePerformanceLog.closed_at.asc(), TradePerformanceLog.id.asc()
        )
        if strategy:
            statement = statement.where(TradePerformanceLog.strategy == strategy)
        if not include_open:
            statement = statement.where(TradePerformanceLog.profit_loss.is_not(None))
        rows = list(db.scalars(statement).all())
        if limit is not None and limit >= 0:
            return rows[-limit:]
        return rows
