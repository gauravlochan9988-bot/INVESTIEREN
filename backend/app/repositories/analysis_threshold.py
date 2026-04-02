from __future__ import annotations

from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.analysis_threshold import AnalysisThreshold


DEFAULT_THRESHOLDS: dict[str, tuple[float, float]] = {
    "simple": (3.0, -3.0),
    "ai": (2.0, -2.0),
    "hedgefund": (4.0, -4.0),
}
SUPPORTED_STRATEGIES = ("simple", "ai", "hedgefund")


class AnalysisThresholdRepository:
    def get_or_create(self, db: Session, strategy: str) -> AnalysisThreshold:
        existing = db.get(AnalysisThreshold, strategy)
        if existing is not None:
            return existing

        default_buy, default_sell = DEFAULT_THRESHOLDS.get(strategy, (3.0, -3.0))
        threshold = AnalysisThreshold(
            strategy=strategy,
            buy_threshold=default_buy,
            sell_threshold=default_sell,
        )
        db.add(threshold)
        db.commit()
        db.refresh(threshold)
        return threshold

    def list_all(self, db: Session) -> list[AnalysisThreshold]:
        rows = list(
            db.scalars(
                select(AnalysisThreshold).order_by(AnalysisThreshold.strategy.asc())
            ).all()
        )

        existing = {row.strategy for row in rows}
        missing = [strategy for strategy in SUPPORTED_STRATEGIES if strategy not in existing]
        if not missing:
            return rows

        for strategy in missing:
            rows.append(self.get_or_create(db, strategy))
        rows.sort(key=lambda item: item.strategy)
        return rows

    def save(
        self,
        db: Session,
        *,
        strategy: str,
        buy_threshold: float,
        sell_threshold: float,
    ) -> AnalysisThreshold:
        threshold = self.get_or_create(db, strategy)
        threshold.buy_threshold = buy_threshold
        threshold.sell_threshold = sell_threshold
        db.add(threshold)
        db.commit()
        db.refresh(threshold)
        return threshold

    def save_many(
        self,
        db: Session,
        *,
        thresholds: Sequence[tuple[str, float, float]],
    ) -> list[AnalysisThreshold]:
        saved: list[AnalysisThreshold] = []
        for strategy, buy_threshold, sell_threshold in thresholds:
            threshold = self.get_or_create(db, strategy)
            threshold.buy_threshold = buy_threshold
            threshold.sell_threshold = sell_threshold
            db.add(threshold)
            saved.append(threshold)
        db.commit()
        for threshold in saved:
            db.refresh(threshold)
        saved.sort(key=lambda item: item.strategy)
        return saved
