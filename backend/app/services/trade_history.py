from __future__ import annotations

from datetime import datetime, time, timezone

from sqlalchemy.orm import Session

from app.models.trade_performance_log import TradePerformanceLog
from app.repositories.trade_performance import TradePerformanceRepository
from app.schemas.analysis import AnalysisResponse
from app.services.market_data import MarketDataService
from app.services.strategy_learning import LEARNING_LAYER_VERSION


class TradeHistoryService:
    def __init__(
        self,
        *,
        market_data_service: MarketDataService,
        trade_performance_repository: TradePerformanceRepository,
    ) -> None:
        self.market_data_service = market_data_service
        self.trade_performance_repository = trade_performance_repository

    def sync_from_analysis(self, db: Session, analysis: AnalysisResponse) -> None:
        if analysis.no_data or analysis.recommendation is None:
            return

        recommendation = analysis.recommendation.upper()
        symbol = self.market_data_service.ensure_supported_symbol(analysis.symbol)
        latest_quote = self.market_data_service.get_latest_quote(symbol, force_refresh=False)
        current_price = float(latest_quote.price)
        now = analysis.generated_at
        if now.tzinfo is None:
            now = now.replace(tzinfo=timezone.utc)

        open_trade = self.trade_performance_repository.get_open_trade(
            db,
            symbol=symbol,
            strategy=analysis.strategy,
        )

        if recommendation == "SELL":
            if open_trade is not None:
                self.trade_performance_repository.close_trade(
                    db,
                    trade=open_trade,
                    exit_price=current_price,
                    closed_at=now,
                    commit=True,
                )
            return

        if recommendation != "BUY":
            return

        if open_trade is not None and (open_trade.recommendation or "").upper() == recommendation:
            return

        if open_trade is not None:
            self.trade_performance_repository.close_trade(
                db,
                trade=open_trade,
                exit_price=current_price,
                closed_at=now,
                commit=False,
            )

        opened_at = now.date()
        trade = TradePerformanceLog(
            symbol=symbol,
            strategy=analysis.strategy,
            learning_version=LEARNING_LAYER_VERSION,
            quantity=1.0,
            entry_price=current_price,
            exit_price=None,
            recommendation=recommendation,
            score=analysis.score,
            confidence=float(analysis.confidence or 0.0),
            data_quality=analysis.data_quality,
            profit_loss=None,
            duration=None,
            opened_at=opened_at,
            closed_at=datetime.combine(opened_at, time.min, tzinfo=timezone.utc),
        )
        self.trade_performance_repository.create(db, trade, commit=False)
        db.commit()
