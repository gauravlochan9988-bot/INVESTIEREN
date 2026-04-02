from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.strategy_learning_adjustment import StrategyLearningAdjustment


class StrategyLearningAdjustmentRepository:
    def count_entries(
        self,
        db: Session,
        *,
        strategy: str,
    ) -> int:
        statement = select(StrategyLearningAdjustment).where(
            StrategyLearningAdjustment.strategy == strategy
        )
        return len(list(db.scalars(statement).all()))

    def get_latest(
        self,
        db: Session,
        *,
        strategy: str,
    ) -> StrategyLearningAdjustment | None:
        statement = (
            select(StrategyLearningAdjustment)
            .where(StrategyLearningAdjustment.strategy == strategy)
            .order_by(
                StrategyLearningAdjustment.created_at.desc(),
                StrategyLearningAdjustment.id.desc(),
            )
            .limit(1)
        )
        return db.scalar(statement)

    def create(
        self,
        db: Session,
        entry: StrategyLearningAdjustment,
        *,
        commit: bool = True,
    ) -> StrategyLearningAdjustment:
        db.add(entry)
        if commit:
            db.commit()
            db.refresh(entry)
        return entry

    def create_if_changed(
        self,
        db: Session,
        *,
        strategy: str,
        learning_version: str,
        trade_count: int,
        win_rate: float,
        average_profit_loss: float,
        average_profit: float,
        average_loss: float,
        buy_accuracy: float,
        sell_error_rate: float,
        confidence_bias: float,
        directional_bias: float,
        weak_signal_multiplier: float,
        buy_threshold_offset: float,
        sell_threshold_offset: float,
        note: str,
    ) -> StrategyLearningAdjustment | None:
        latest = self.get_latest(db, strategy=strategy)
        comparable = (
            learning_version,
            trade_count,
            round(win_rate, 4),
            round(average_profit_loss, 2),
            round(average_profit, 2),
            round(average_loss, 2),
            round(buy_accuracy, 4),
            round(sell_error_rate, 4),
            round(confidence_bias, 2),
            round(directional_bias, 2),
            round(weak_signal_multiplier, 3),
            round(buy_threshold_offset, 2),
            round(sell_threshold_offset, 2),
            note,
        )
        if latest is not None:
            latest_comparable = (
                latest.learning_version,
                latest.trade_count,
                round(float(latest.win_rate), 4),
                round(float(latest.average_profit_loss), 2),
                round(float(latest.average_profit), 2),
                round(float(latest.average_loss), 2),
                round(float(latest.buy_accuracy), 4),
                round(float(latest.sell_error_rate), 4),
                round(float(latest.confidence_bias), 2),
                round(float(latest.directional_bias), 2),
                round(float(latest.weak_signal_multiplier), 3),
                round(float(latest.buy_threshold_offset), 2),
                round(float(latest.sell_threshold_offset), 2),
                latest.note,
            )
            if latest_comparable == comparable:
                return None

        entry = StrategyLearningAdjustment(
            strategy=strategy,
            learning_version=learning_version,
            trade_count=trade_count,
            win_rate=round(win_rate, 4),
            average_profit_loss=round(average_profit_loss, 2),
            average_profit=round(average_profit, 2),
            average_loss=round(average_loss, 2),
            buy_accuracy=round(buy_accuracy, 4),
            sell_error_rate=round(sell_error_rate, 4),
            confidence_bias=round(confidence_bias, 2),
            directional_bias=round(directional_bias, 2),
            weak_signal_multiplier=round(weak_signal_multiplier, 3),
            buy_threshold_offset=round(buy_threshold_offset, 2),
            sell_threshold_offset=round(sell_threshold_offset, 2),
            note=note,
        )
        return self.create(db, entry)
