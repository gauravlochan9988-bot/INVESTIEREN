from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.repositories.analysis_threshold import (
    DEFAULT_THRESHOLDS,
    SUPPORTED_STRATEGIES,
    AnalysisThresholdRepository,
)
from app.repositories.strategy_learning_adjustment import StrategyLearningAdjustmentRepository
from app.repositories.trade_performance import TradePerformanceRepository
from app.schemas.analysis import LearningInsight, Strategy
from app.schemas.analysis_tracking import (
    StrategyLearningStats,
    StrategyLearningStatsResponse,
    StrategyThresholds,
)


LEARNING_LAYER_VERSION = "performance-learning-v6"
MIN_TRADES_REQUIRED = 50
CONFIDENCE_STEP = 10.0
THRESHOLD_STEP = 0.5


@dataclass(frozen=True)
class StrategyLearningProfile:
    strategy: str
    learning_version: str = LEARNING_LAYER_VERSION
    trade_count: int = 0
    eligible: bool = False
    min_trades_required: int = MIN_TRADES_REQUIRED
    win_rate: float = 0.0
    average_profit_loss: float = 0.0
    average_profit: float = 0.0
    average_loss: float = 0.0
    drawdown: float = 0.0
    buy_accuracy: float = 0.0
    sell_error_rate: float = 0.0
    confidence_bias: float = 0.0
    directional_bias: float = 0.0
    weak_signal_multiplier: float = 1.0
    buy_threshold_offset: float = 0.0
    sell_threshold_offset: float = 0.0
    note: str = ""
    thresholds: StrategyThresholds | None = None
    effective_thresholds: StrategyThresholds | None = None
    adjustment_count: int = 0

    def to_learning_insight(self) -> LearningInsight:
        return LearningInsight(
            version=self.learning_version,
            active=self.eligible,
            trade_count=self.trade_count,
            min_trades_required=self.min_trades_required,
            win_rate=self.win_rate,
            average_profit_loss=self.average_profit_loss,
            average_profit=self.average_profit,
            average_loss=self.average_loss,
            drawdown=self.drawdown,
            buy_accuracy=self.buy_accuracy,
            sell_error_rate=self.sell_error_rate,
            confidence_bias=self.confidence_bias,
            directional_bias=self.directional_bias,
            weak_signal_multiplier=self.weak_signal_multiplier,
            buy_threshold_offset=self.buy_threshold_offset,
            sell_threshold_offset=self.sell_threshold_offset,
            thresholds=self.thresholds,
            effective_thresholds=self.effective_thresholds,
            adjustment_count=self.adjustment_count,
            note=self.note,
        )

    def to_stats(self) -> StrategyLearningStats:
        return StrategyLearningStats(
            strategy=self.strategy,
            learning_version=self.learning_version,
            trade_count=self.trade_count,
            eligible=self.eligible,
            min_trades_required=self.min_trades_required,
            win_rate=self.win_rate,
            average_profit_loss=self.average_profit_loss,
            average_profit=self.average_profit,
            average_loss=self.average_loss,
            drawdown=self.drawdown,
            buy_accuracy=self.buy_accuracy,
            sell_error_rate=self.sell_error_rate,
            confidence_bias=self.confidence_bias,
            directional_bias=self.directional_bias,
            weak_signal_multiplier=self.weak_signal_multiplier,
            buy_threshold_offset=self.buy_threshold_offset,
            sell_threshold_offset=self.sell_threshold_offset,
            effective_thresholds=self.effective_thresholds,
            adjustment_count=self.adjustment_count,
            note=self.note,
            thresholds=self.thresholds,
        )


class StrategyLearningService:
    def __init__(
        self,
        *,
        trade_performance_repository: TradePerformanceRepository | None = None,
        analysis_threshold_repository: AnalysisThresholdRepository | None = None,
        adjustment_repository: StrategyLearningAdjustmentRepository | None = None,
        min_trades_required: int = MIN_TRADES_REQUIRED,
    ) -> None:
        self.trade_performance_repository = trade_performance_repository or TradePerformanceRepository()
        self.analysis_threshold_repository = (
            analysis_threshold_repository or AnalysisThresholdRepository()
        )
        self.adjustment_repository = adjustment_repository or StrategyLearningAdjustmentRepository()
        self.min_trades_required = min_trades_required

    def inactive_profile(self, strategy: Strategy | str) -> StrategyLearningProfile:
        normalized_strategy = str(strategy).strip().lower()
        base_thresholds = self._base_thresholds(normalized_strategy)
        return StrategyLearningProfile(
            strategy=normalized_strategy,
            min_trades_required=self.min_trades_required,
            thresholds=base_thresholds,
            effective_thresholds=base_thresholds,
            note=(
                f"Learning stays neutral until at least {self.min_trades_required} closed trades "
                "with realized profit or loss are available."
            ),
        )

    def get_profile(self, db: Session, strategy: Strategy | str) -> StrategyLearningProfile:
        normalized_strategy = str(strategy).strip().lower()
        rows = self.trade_performance_repository.list_entries(db, strategy=normalized_strategy)
        realized = [row for row in rows if row.profit_loss is not None]
        base_thresholds = self._base_thresholds(normalized_strategy)
        adjustment_count = self.adjustment_repository.count_entries(db, strategy=normalized_strategy)

        if not realized:
            persisted = self._persist_thresholds(
                db,
                strategy=normalized_strategy,
                thresholds=base_thresholds,
            )
            return StrategyLearningProfile(
                strategy=normalized_strategy,
                min_trades_required=self.min_trades_required,
                thresholds=persisted,
                effective_thresholds=persisted,
                adjustment_count=adjustment_count,
                note=(
                    f"No realized trades are logged for {normalized_strategy} yet, so learning "
                    "stays neutral."
                ),
            )

        pnl_values = [float(row.profit_loss or 0.0) for row in realized]
        trade_count = len(pnl_values)
        wins = [value for value in pnl_values if value > 0]
        losses = [value for value in pnl_values if value < 0]
        buy_trades = [row for row in realized if (row.recommendation or "").upper() == "BUY"]
        sell_trades = [row for row in realized if (row.recommendation or "").upper() == "SELL"]

        win_rate = round(len(wins) / trade_count, 4) if trade_count else 0.0
        average_profit_loss = round(sum(pnl_values) / trade_count, 2) if trade_count else 0.0
        average_profit = round(sum(wins) / len(wins), 2) if wins else 0.0
        average_loss = round(sum(losses) / len(losses), 2) if losses else 0.0
        drawdown = round(self._max_drawdown(pnl_values), 2)
        buy_accuracy = (
            round(
                sum(1 for row in buy_trades if (row.profit_loss or 0.0) > 0) / len(buy_trades),
                4,
            )
            if buy_trades
            else 0.0
        )
        sell_error_rate = (
            round(
                sum(1 for row in sell_trades if (row.profit_loss or 0.0) >= 0) / len(sell_trades),
                4,
            )
            if sell_trades
            else 0.0
        )

        if trade_count < self.min_trades_required:
            persisted = self._persist_thresholds(
                db,
                strategy=normalized_strategy,
                thresholds=base_thresholds,
            )
            return StrategyLearningProfile(
                strategy=normalized_strategy,
                trade_count=trade_count,
                eligible=False,
                min_trades_required=self.min_trades_required,
                win_rate=win_rate,
                average_profit_loss=average_profit_loss,
                average_profit=average_profit,
                average_loss=average_loss,
                drawdown=drawdown,
                buy_accuracy=buy_accuracy,
                sell_error_rate=sell_error_rate,
                thresholds=persisted,
                effective_thresholds=persisted,
                adjustment_count=adjustment_count,
                note=(
                    f"{trade_count} realized trades are logged. Learning stays neutral until "
                    f"{self.min_trades_required} trades are available."
                ),
            )

        performance_tier = self._performance_tier(
            win_rate=win_rate,
            average_profit_loss=average_profit_loss,
            drawdown=drawdown,
            average_profit=average_profit,
        )
        confidence_bias = self._confidence_bias_for_tier(performance_tier)
        directional_bias = 0.0
        weak_signal_multiplier = 1.0
        buy_offset, sell_offset = self._threshold_offsets_for_tier(performance_tier)
        effective_thresholds = self._effective_thresholds(
            base_thresholds,
            buy_threshold_offset=buy_offset,
            sell_threshold_offset=sell_offset,
        )
        persisted = self._persist_thresholds(
            db,
            strategy=normalized_strategy,
            thresholds=effective_thresholds,
        )
        note = self._note_for_tier(strategy=normalized_strategy, performance_tier=performance_tier)

        self.adjustment_repository.create_if_changed(
            db,
            strategy=normalized_strategy,
            learning_version=LEARNING_LAYER_VERSION,
            trade_count=trade_count,
            win_rate=win_rate,
            average_profit_loss=average_profit_loss,
            average_profit=average_profit,
            average_loss=average_loss,
            buy_accuracy=buy_accuracy,
            sell_error_rate=sell_error_rate,
            confidence_bias=confidence_bias,
            directional_bias=directional_bias,
            weak_signal_multiplier=weak_signal_multiplier,
            buy_threshold_offset=buy_offset,
            sell_threshold_offset=sell_offset,
            note=note,
        )
        adjustment_count = self.adjustment_repository.count_entries(db, strategy=normalized_strategy)

        return StrategyLearningProfile(
            strategy=normalized_strategy,
            trade_count=trade_count,
            eligible=True,
            min_trades_required=self.min_trades_required,
            win_rate=win_rate,
            average_profit_loss=average_profit_loss,
            average_profit=average_profit,
            average_loss=average_loss,
            drawdown=drawdown,
            buy_accuracy=buy_accuracy,
            sell_error_rate=sell_error_rate,
            confidence_bias=confidence_bias,
            directional_bias=directional_bias,
            weak_signal_multiplier=weak_signal_multiplier,
            buy_threshold_offset=buy_offset,
            sell_threshold_offset=sell_offset,
            thresholds=persisted,
            effective_thresholds=persisted,
            adjustment_count=adjustment_count,
            note=note,
        )

    def get_stats(self, db: Session) -> StrategyLearningStatsResponse:
        strategies = [self.get_profile(db, strategy).to_stats() for strategy in SUPPORTED_STRATEGIES]
        return StrategyLearningStatsResponse(
            version=LEARNING_LAYER_VERSION,
            strategies=strategies,
        )

    def _base_thresholds(self, strategy: str) -> StrategyThresholds:
        buy_threshold, sell_threshold = DEFAULT_THRESHOLDS.get(strategy, (3.0, -3.0))
        return StrategyThresholds(
            buy_threshold=round(float(buy_threshold), 2),
            sell_threshold=round(float(sell_threshold), 2),
            updated_at=None,
        )

    def _effective_thresholds(
        self,
        base_thresholds: StrategyThresholds,
        *,
        buy_threshold_offset: float,
        sell_threshold_offset: float,
    ) -> StrategyThresholds:
        return StrategyThresholds(
            buy_threshold=round(base_thresholds.buy_threshold + buy_threshold_offset, 2),
            sell_threshold=round(base_thresholds.sell_threshold + sell_threshold_offset, 2),
            updated_at=base_thresholds.updated_at,
        )

    def _persist_thresholds(
        self,
        db: Session,
        *,
        strategy: str,
        thresholds: StrategyThresholds,
    ) -> StrategyThresholds:
        saved = self.analysis_threshold_repository.save(
            db,
            strategy=strategy,
            buy_threshold=round(thresholds.buy_threshold, 2),
            sell_threshold=round(thresholds.sell_threshold, 2),
        )
        return StrategyThresholds(
            buy_threshold=round(float(saved.buy_threshold), 2),
            sell_threshold=round(float(saved.sell_threshold), 2),
            updated_at=saved.updated_at,
        )

    def _performance_tier(
        self,
        *,
        win_rate: float,
        average_profit_loss: float,
        drawdown: float,
        average_profit: float,
    ) -> str:
        if win_rate > 0.60:
            return "good"
        if win_rate < 0.40:
            return "weak"
        return "neutral"

    def _confidence_bias_for_tier(self, performance_tier: str) -> float:
        if performance_tier == "good":
            return CONFIDENCE_STEP
        if performance_tier == "weak":
            return -CONFIDENCE_STEP
        return 0.0

    def _threshold_offsets_for_tier(self, performance_tier: str) -> tuple[float, float]:
        if performance_tier == "good":
            return (-THRESHOLD_STEP, THRESHOLD_STEP)
        if performance_tier == "weak":
            return (THRESHOLD_STEP, -THRESHOLD_STEP)
        return (0.0, 0.0)

    def _note_for_tier(self, *, strategy: str, performance_tier: str) -> str:
        if performance_tier == "good":
            return (
                f"{strategy} has a realized win rate above 60%, so confidence is increased and "
                "thresholds are eased slightly."
            )
        if performance_tier == "weak":
            return (
                f"{strategy} has a realized win rate below 40%, so confidence is reduced and "
                "thresholds are tightened slightly."
            )
        return (
            f"{strategy} is in a neutral performance band, so thresholds stay at their base levels."
        )

    def _max_drawdown(self, pnl_values: list[float]) -> float:
        peak = 0.0
        equity = 0.0
        max_drawdown = 0.0
        for value in pnl_values:
            equity += value
            peak = max(peak, equity)
            max_drawdown = max(max_drawdown, peak - equity)
        return max_drawdown
