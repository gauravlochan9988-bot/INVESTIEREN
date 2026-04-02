from __future__ import annotations

from collections import Counter

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.analysis_log import AnalysisLog
from app.schemas.analysis_tracking import StrategyDistributionStats, StrategyThresholds


class AnalysisLogRepository:
    def create(
        self,
        db: Session,
        *,
        symbol: str,
        strategy: str,
        score: int | None,
        recommendation: str | None,
        data_quality: str,
        confidence: float,
    ) -> AnalysisLog:
        entry = AnalysisLog(
            symbol=symbol,
            strategy=strategy,
            score=score,
            recommendation=recommendation,
            data_quality=data_quality,
            confidence=confidence,
        )
        db.add(entry)
        db.commit()
        db.refresh(entry)
        return entry

    def get_latest_for_symbol_strategy(
        self,
        db: Session,
        *,
        symbol: str,
        strategy: str,
    ) -> AnalysisLog | None:
        statement = (
            select(AnalysisLog)
            .where(
                AnalysisLog.symbol == symbol,
                AnalysisLog.strategy == strategy,
            )
            .order_by(AnalysisLog.created_at.desc(), AnalysisLog.id.desc())
            .limit(1)
        )
        return db.scalar(statement)

    def get_grouped_entries(self, db: Session) -> dict[str, list[AnalysisLog]]:
        rows = list(
            db.scalars(
                select(AnalysisLog).order_by(AnalysisLog.strategy.asc(), AnalysisLog.id.asc())
            ).all()
        )

        grouped: dict[str, list[AnalysisLog]] = {}
        for row in rows:
            grouped.setdefault(row.strategy, []).append(row)
        return grouped

    def _build_strategy_stats(
        self,
        strategy: str,
        entries: list[AnalysisLog],
        *,
        thresholds: StrategyThresholds,
    ) -> StrategyDistributionStats:
        counts = Counter(
            entry.recommendation for entry in entries if entry.recommendation in {"BUY", "SELL", "HOLD"}
        )
        total = sum(counts.values())

        def percent(label: str) -> float:
            if total == 0:
                return 0.0
            return round((counts[label] / total) * 100, 1)

        return StrategyDistributionStats(
            strategy=strategy,
            total=total,
            buy_count=counts["BUY"],
            sell_count=counts["SELL"],
            hold_count=counts["HOLD"],
            buy_percent=percent("BUY"),
            sell_percent=percent("SELL"),
            hold_percent=percent("HOLD"),
            thresholds=thresholds,
        )
