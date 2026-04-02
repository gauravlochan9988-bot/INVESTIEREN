from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.repositories.analysis_log import AnalysisLogRepository
from app.repositories.analysis_threshold import (
    DEFAULT_THRESHOLDS,
    SUPPORTED_STRATEGIES,
    AnalysisThresholdRepository,
)
from app.schemas.analysis import Strategy
from app.schemas.analysis_tracking import (
    AnalysisDistributionStats,
    StrategyDistributionStats,
    StrategyThresholds,
)
from app.services.analysis import AnalysisService

FIXED_STRATEGY_THRESHOLDS: dict[str, tuple[float, float]] = DEFAULT_THRESHOLDS.copy()


@dataclass(frozen=True)
class CalibrationTargets:
    buy_percent: float = 30.0
    sell_percent: float = 30.0
    hold_percent: float = 40.0


class AnalysisCalibrationService:
    def __init__(
        self,
        *,
        analysis_log_repository: AnalysisLogRepository,
        analysis_threshold_repository: AnalysisThresholdRepository,
        analysis_service: AnalysisService | None = None,
        targets: CalibrationTargets = CalibrationTargets(),
        minimum_samples: int = 10,
        tolerance_percent: float = 3.0,
        max_adjustment_step: float = 0.5,
    ) -> None:
        self.analysis_log_repository = analysis_log_repository
        self.analysis_threshold_repository = analysis_threshold_repository
        self.analysis_service = analysis_service
        self.targets = targets
        self.minimum_samples = minimum_samples
        self.tolerance_percent = tolerance_percent
        self.max_adjustment_step = max_adjustment_step

    def get_distribution_stats(self, db: Session) -> AnalysisDistributionStats:
        grouped = self.analysis_log_repository.get_grouped_entries(db)
        thresholds = {
            row.strategy: row
            for row in self.analysis_threshold_repository.list_all(db)
        }

        strategies: list[StrategyDistributionStats] = []
        for strategy in SUPPORTED_STRATEGIES:
            threshold_row = thresholds[strategy]
            strategies.append(
                self.analysis_log_repository._build_strategy_stats(  # noqa: SLF001
                    strategy,
                    grouped.get(strategy, []),
                    thresholds=StrategyThresholds(
                        buy_threshold=round(threshold_row.buy_threshold, 2),
                        sell_threshold=round(threshold_row.sell_threshold, 2),
                        updated_at=threshold_row.updated_at,
                    ),
                )
            )
        return AnalysisDistributionStats(strategies=strategies)

    def recalibrate_strategy(self, db: Session, strategy: Strategy) -> StrategyThresholds:
        saved = self.analysis_threshold_repository.get_or_create(db, strategy)
        self._sync_runtime_thresholds(strategy, saved.buy_threshold, saved.sell_threshold)
        return StrategyThresholds(
            buy_threshold=round(saved.buy_threshold, 2),
            sell_threshold=round(saved.sell_threshold, 2),
            updated_at=saved.updated_at,
        )

    def initialize_runtime_thresholds(self, db: Session) -> None:
        self.analysis_threshold_repository.save_many(
            db,
            thresholds=[
                (strategy, thresholds[0], thresholds[1])
                for strategy, thresholds in FIXED_STRATEGY_THRESHOLDS.items()
            ],
        )
        for row in self.analysis_threshold_repository.list_all(db):
            self._sync_runtime_thresholds(
                row.strategy,
                row.buy_threshold,
                row.sell_threshold,
            )

    def _sync_runtime_thresholds(
        self,
        strategy: Strategy | str,
        buy_threshold: float,
        sell_threshold: float,
    ) -> None:
        if self.analysis_service is None:
            return
        self.analysis_service.set_strategy_thresholds(
            strategy=strategy,
            buy_threshold=buy_threshold,
            sell_threshold=sell_threshold,
        )

    def _bounded_delta(self, value: float) -> float:
        return max(-self.max_adjustment_step, min(self.max_adjustment_step, value))

    def _normalized_buy_threshold(self, value: float) -> float:
        return round(max(1.5, min(5.0, value)), 2)

    def _normalized_sell_threshold(self, value: float) -> float:
        return round(min(-1.5, max(-5.0, value)), 2)
