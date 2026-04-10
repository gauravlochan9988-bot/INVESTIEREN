from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Optional

from sqlalchemy.orm import Session

from app.repositories.alert_repository import AlertRepository
from app.repositories.favorite_symbol import FavoriteSymbolRepository
from app.schemas.analysis import AnalysisResponse, Strategy
from app.services.analysis import AnalysisService
from app.services.market_data import MarketDataService

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class FavoriteSignalScanSummary:
    user_keys_scanned: int
    symbols_checked: int
    events_created: int
    baseline_seeded: int
    skipped_no_data: int


def _eligible_for_buy_sell_notification(
    analysis: AnalysisResponse,
    *,
    min_confidence_partial: float,
) -> bool:
    if analysis.no_data or analysis.data_quality == "NO_DATA":
        return False
    if analysis.recommendation not in ("BUY", "SELL"):
        return False
    if analysis.no_trade:
        return False
    if analysis.data_quality == "FULL" and analysis.signal_quality == "FULL":
        return True
    if analysis.data_quality == "PARTIAL" or analysis.signal_quality == "PARTIAL":
        return float(analysis.confidence or 0.0) >= min_confidence_partial
    return False


class FavoriteSignalMonitorService:
    """Background scan: favorites only, BUY/SELL transitions, uses alert_states + alert_events."""

    def __init__(
        self,
        *,
        analysis_service: AnalysisService,
        market_data_service: MarketDataService,
        alert_repository: AlertRepository,
        favorite_repository: FavoriteSymbolRepository,
        min_confidence_partial: float = 58.0,
    ) -> None:
        self.analysis_service = analysis_service
        self.market_data_service = market_data_service
        self.alert_repository = alert_repository
        self.favorite_repository = favorite_repository
        self.min_confidence_partial = min_confidence_partial

    def run_scan(
        self,
        db: Session,
        *,
        strategy: Strategy,
        force_refresh: bool = True,
    ) -> FavoriteSignalScanSummary:
        user_keys = self.favorite_repository.list_distinct_user_keys(db)
        events = 0
        baseline = 0
        skipped_nd = 0
        symbols_checked = 0

        for user_key in user_keys:
            app_uid = self.favorite_repository.get_app_user_id_for_user_key(db, user_key=user_key)
            symbols = self.favorite_repository.list_symbols(db, user_key=user_key, app_user_id=app_uid)
            for symbol in symbols:
                symbols_checked += 1
                ev, bs, sk = self._process_favorite_symbol(
                    db,
                    user_key=user_key,
                    app_user_id=app_uid,
                    symbol=symbol,
                    strategy=strategy,
                    force_refresh=force_refresh,
                )
                events += ev
                baseline += bs
                skipped_nd += sk

        db.commit()
        summary = FavoriteSignalScanSummary(
            user_keys_scanned=len(user_keys),
            symbols_checked=symbols_checked,
            events_created=events,
            baseline_seeded=baseline,
            skipped_no_data=skipped_nd,
        )
        logger.info(
            "favorite_signal_scan complete",
            extra={
                "strategy": strategy,
                "user_keys": summary.user_keys_scanned,
                "symbols_checked": summary.symbols_checked,
                "events_created": summary.events_created,
                "baseline_seeded": summary.baseline_seeded,
                "skipped_no_data": summary.skipped_no_data,
            },
        )
        return summary

    def _process_favorite_symbol(
        self,
        db: Session,
        *,
        user_key: str,
        app_user_id: Optional[int],
        symbol: str,
        strategy: Strategy,
        force_refresh: bool,
    ) -> tuple[int, int, int]:
        """Returns (events_created, baseline_seeded, skipped_no_data)."""
        analysis = self.analysis_service.analyze_symbol(
            symbol,
            force_refresh=force_refresh,
            strategy=strategy,
            db=db,
        )

        if analysis.no_data or analysis.data_quality == "NO_DATA" or analysis.recommendation is None:
            return (0, 0, 1)

        quote = None
        try:
            quote = self.market_data_service.get_latest_quote(symbol, force_refresh=force_refresh)
        except Exception:
            quote = None

        price = quote.price if quote is not None and quote.price and quote.price > 0 else None
        chg = quote.change_percent if quote is not None else None

        prev = self.alert_repository.get_state(
            db,
            user_key=user_key,
            app_user_id=app_user_id,
            symbol=symbol,
            strategy=strategy,
        )
        eligible = _eligible_for_buy_sell_notification(
            analysis,
            min_confidence_partial=self.min_confidence_partial,
        )
        new_rec = analysis.recommendation
        events_created = 0
        baseline_seeded = 0

        if prev is None:
            self.alert_repository.save_state(
                db,
                user_key=user_key,
                app_user_id=app_user_id,
                symbol=symbol,
                strategy=strategy,
                price=price,
                recommendation=new_rec,
                data_quality=analysis.data_quality,
                confidence=float(analysis.confidence or 0.0),
                is_favorite=True,
                commit=False,
            )
            baseline_seeded = 1
            return (events_created, baseline_seeded, 0)

        prev_rec = prev.last_recommendation

        if (
            eligible
            and new_rec in ("BUY", "SELL")
            and prev_rec != new_rec
        ):
            tone = "bullish" if new_rec == "BUY" else "bearish"
            conf = int(round(float(analysis.confidence or 0.0)))
            self.alert_repository.create_event(
                db,
                user_key=user_key,
                app_user_id=app_user_id,
                symbol=symbol,
                strategy=strategy,
                kind="favorite_signal",
                tone=tone,
                title=f"{symbol} · Smart Alert: {new_rec}",
                message=(
                    f"Smart Alert (gespeichertes Symbol): {symbol} wechselte auf {new_rec} ({strategy}). "
                    f"Konfidenz {conf}%, Datenqualität {analysis.data_quality}, Signal {analysis.signal_quality}."
                ),
                priority=120 + conf,
                recommendation=new_rec,
                data_quality=analysis.data_quality,
                price=price,
                change_percent=chg,
                is_favorite=True,
                commit=False,
            )
            events_created = 1

        self.alert_repository.save_state(
            db,
            user_key=user_key,
            app_user_id=app_user_id,
            symbol=symbol,
            strategy=strategy,
            price=price,
            recommendation=new_rec,
            data_quality=analysis.data_quality,
            confidence=float(analysis.confidence or 0.0),
            is_favorite=True,
            commit=False,
        )
        return (events_created, baseline_seeded, 0)
