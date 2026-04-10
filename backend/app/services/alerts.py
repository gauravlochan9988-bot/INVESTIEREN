from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from typing import Optional, Sequence

from sqlalchemy.orm import Session

from app.repositories.alert_repository import AlertRepository
from app.repositories.alert_rule import AlertRuleRepository
from app.repositories.favorite_symbol import FavoriteSymbolRepository
from app.schemas.analysis import AnalysisAlert, AnalysisResponse, Strategy
from app.services.analysis import AnalysisService
from app.services.market_data import MarketDataService


class AlertService:
    def __init__(
        self,
        *,
        analysis_service: AnalysisService,
        market_data_service: MarketDataService,
        alert_repository: AlertRepository,
        favorite_repository: FavoriteSymbolRepository,
        alert_rule_repository: AlertRuleRepository,
        default_symbols: Sequence[str],
        price_move_threshold_percent: float = 1.0,
    ) -> None:
        self.analysis_service = analysis_service
        self.market_data_service = market_data_service
        self.alert_repository = alert_repository
        self.favorite_repository = favorite_repository
        self.alert_rule_repository = alert_rule_repository
        self.default_symbols = tuple(default_symbols)
        self.price_move_threshold_percent = price_move_threshold_percent

    def list_favorites(
        self,
        db: Session,
        *,
        user_key: str,
        app_user_id: Optional[int] = None,
    ) -> list[str]:
        return self.favorite_repository.list_symbols(db, user_key=user_key, app_user_id=app_user_id)

    def add_favorite(
        self,
        db: Session,
        *,
        user_key: str,
        symbol: str,
        app_user_id: Optional[int] = None,
        strategy: Strategy = "hedgefund",
    ) -> str:
        normalized = self.market_data_service.ensure_supported_symbol(symbol)
        self.favorite_repository.create(
            db,
            user_key=user_key,
            symbol=normalized,
            app_user_id=app_user_id,
        )
        if app_user_id is not None:
            self.alert_rule_repository.create(
                db,
                user_id=app_user_id,
                symbol=normalized,
                strategy=strategy,
                enabled=True,
                notify_on_buy=True,
                notify_on_sell=True,
                min_confidence=60.0,
            )
            self._prime_alert_rule_from_analysis(
                db,
                user_id=app_user_id,
                symbol=normalized,
                strategy=strategy,
            )
        return normalized

    def remove_favorite(
        self,
        db: Session,
        *,
        user_key: str,
        symbol: str,
        app_user_id: Optional[int] = None,
    ) -> bool:
        normalized = self.market_data_service.ensure_supported_symbol(symbol)
        deleted = self.favorite_repository.delete(
            db,
            user_key=user_key,
            symbol=normalized,
            app_user_id=app_user_id,
        )
        if deleted and app_user_id is not None:
            self.alert_rule_repository.delete_all_for_user_symbol(
                db,
                user_id=app_user_id,
                symbol=normalized,
            )
        return deleted

    def _prime_alert_rule_from_analysis(
        self,
        db: Session,
        *,
        user_id: int,
        symbol: str,
        strategy: Strategy,
    ) -> None:
        rule = self.alert_rule_repository.get_by_user_symbol_strategy(
            db,
            user_id=user_id,
            symbol=symbol,
            strategy=strategy,
        )
        if rule is None:
            return
        analysis = self.analysis_service.analyze_symbol(
            symbol,
            force_refresh=False,
            strategy=strategy,
            db=db,
        )
        if analysis.no_data or analysis.data_quality == "NO_DATA" or analysis.recommendation is None:
            rule.last_evaluated_signal = "NO_DATA"
        else:
            rule.last_evaluated_signal = analysis.recommendation
        db.add(rule)
        db.commit()

    def sync_alerts(
        self,
        db: Session,
        *,
        strategy: Strategy,
        user_key: str = "default",
        app_user_id: Optional[int] = None,
        force_refresh: bool = False,
        limit: int = 6,
        favorites_only: bool = False,
    ) -> list[AnalysisAlert]:
        favorites = self.favorite_repository.list_symbols(db, user_key=user_key, app_user_id=app_user_id)
        favorite_set = set(favorites)
        universe = favorites[:] + [symbol for symbol in self.default_symbols if symbol not in favorite_set]
        if favorites_only:
            universe = favorites[:]

        if universe:
            analyses = self._collect_analyses(
                symbols=universe,
                strategy=strategy,
                force_refresh=force_refresh,
                db=db,
            )
            for analysis in analyses:
                self._sync_symbol_alerts(
                    db,
                    analysis=analysis,
                    strategy=strategy,
                    user_key=user_key,
                    app_user_id=app_user_id,
                    is_favorite=analysis.symbol in favorite_set,
                    force_refresh=force_refresh,
                )
            db.commit()

        rows = self.alert_repository.list_recent_events(
            db,
            user_key=user_key,
            app_user_id=app_user_id,
            strategy=strategy,
            limit=limit,
            favorites_only=favorites_only,
        )
        return [self._row_to_schema(row) for row in rows]

    def _collect_analyses(
        self,
        *,
        symbols: Sequence[str],
        strategy: Strategy,
        force_refresh: bool,
        db: Session,
    ) -> list[AnalysisResponse]:
        if len(symbols) <= 1:
            return [
                self.analysis_service.analyze_symbol(
                    symbol,
                    force_refresh=force_refresh,
                    strategy=strategy,
                    db=db,
                )
                for symbol in symbols
            ]

        max_workers = min(6, len(symbols))
        with ThreadPoolExecutor(max_workers=max_workers, thread_name_prefix="alert-sync") as pool:
            futures = [
                pool.submit(
                    self.analysis_service.analyze_symbol,
                    symbol,
                    force_refresh,
                    strategy,
                    None,
                )
                for symbol in symbols
            ]
            return [future.result() for future in futures]

    def _sync_symbol_alerts(
        self,
        db: Session,
        *,
        analysis: AnalysisResponse,
        strategy: Strategy,
        user_key: str,
        app_user_id: Optional[int],
        is_favorite: bool,
        force_refresh: bool,
    ) -> bool:
        if analysis.no_data or analysis.recommendation is None or analysis.data_quality == "NO_DATA":
            return False

        quote = None
        try:
            quote = self.market_data_service.get_latest_quote(
                analysis.symbol,
                force_refresh=force_refresh,
            )
        except Exception:
            quote = None

        previous_state = self.alert_repository.get_state(
            db,
            user_key=user_key,
            app_user_id=app_user_id,
            symbol=analysis.symbol,
            strategy=strategy,
        )
        created = False

        if previous_state is None:
            for seed in self.analysis_service._alerts_from_analysis(analysis):  # noqa: SLF001
                self.alert_repository.create_event(
                    db,
                    user_key=user_key,
                    app_user_id=app_user_id,
                    symbol=seed.symbol,
                    strategy=seed.strategy,
                    kind=seed.kind,
                    tone=seed.tone,
                    title=seed.title,
                    message=seed.message,
                    priority=seed.priority,
                    recommendation=analysis.recommendation,
                    data_quality=analysis.data_quality,
                    price=quote.price if quote is not None else None,
                    change_percent=quote.change_percent if quote is not None else None,
                    is_favorite=is_favorite,
                    commit=False,
                )
                created = True
        else:
            if (
                previous_state.last_recommendation
                and previous_state.last_recommendation != analysis.recommendation
            ):
                alert = self._signal_change_alert(analysis)
                self.alert_repository.create_event(
                    db,
                    user_key=user_key,
                    app_user_id=app_user_id,
                    symbol=alert.symbol,
                    strategy=alert.strategy,
                    kind=alert.kind,
                    tone=alert.tone,
                    title=alert.title,
                    message=alert.message,
                    priority=alert.priority,
                    recommendation=analysis.recommendation,
                    data_quality=analysis.data_quality,
                    price=quote.price if quote is not None else None,
                    change_percent=quote.change_percent if quote is not None else None,
                    is_favorite=is_favorite,
                    commit=False,
                )
                created = True

            if (
                quote is not None
                and previous_state.last_price
                and self._price_move_percent(previous_state.last_price, quote.price)
                >= self.price_move_threshold_percent
            ):
                alert = self._price_change_alert(
                    analysis=analysis,
                    current_price=quote.price,
                    previous_price=previous_state.last_price,
                )
                self.alert_repository.create_event(
                    db,
                    user_key=user_key,
                    app_user_id=app_user_id,
                    symbol=alert.symbol,
                    strategy=alert.strategy,
                    kind=alert.kind,
                    tone=alert.tone,
                    title=alert.title,
                    message=alert.message,
                    priority=alert.priority,
                    recommendation=analysis.recommendation,
                    data_quality=analysis.data_quality,
                    price=quote.price,
                    change_percent=quote.change_percent,
                    is_favorite=is_favorite,
                    commit=False,
                )
                created = True

        self.alert_repository.save_state(
            db,
            user_key=user_key,
            app_user_id=app_user_id,
            symbol=analysis.symbol,
            strategy=strategy,
            price=quote.price if quote is not None else None,
            recommendation=analysis.recommendation,
            data_quality=analysis.data_quality,
            confidence=float(analysis.confidence or 0.0),
            is_favorite=is_favorite,
            commit=False,
        )
        return created

    def _signal_change_alert(self, analysis: AnalysisResponse) -> AnalysisAlert:
        confidence = int(round(float(analysis.confidence or 0.0)))
        if analysis.recommendation == "BUY":
            return AnalysisAlert(
                symbol=analysis.symbol,
                strategy=analysis.strategy,
                kind="recommendation",
                tone="bullish",
                title=f"{analysis.symbol} is now BUY",
                message=f"{analysis.symbol} moved into a buy setup with {confidence}% confidence.",
                priority=110 + confidence,
            )
        if analysis.recommendation == "SELL":
            return AnalysisAlert(
                symbol=analysis.symbol,
                strategy=analysis.strategy,
                kind="recommendation",
                tone="bearish",
                title=f"{analysis.symbol} is now SELL",
                message=f"{analysis.symbol} moved into a sell setup with {confidence}% confidence.",
                priority=110 + confidence,
            )
        return AnalysisAlert(
            symbol=analysis.symbol,
            strategy=analysis.strategy,
            kind="signal",
            tone="neutral",
            title=f"{analysis.symbol} moved to HOLD",
            message="The setup is mixed again, so the signal moved back to HOLD.",
            priority=85 + confidence,
        )

    def _price_change_alert(
        self,
        *,
        analysis: AnalysisResponse,
        current_price: float,
        previous_price: float,
    ) -> AnalysisAlert:
        move_percent = self._price_move_percent(previous_price, current_price)
        bullish = current_price >= previous_price
        direction = "up" if bullish else "down"
        return AnalysisAlert(
            symbol=analysis.symbol,
            strategy=analysis.strategy,
            kind="price",
            tone="bullish" if bullish else "bearish",
            title=f"{analysis.symbol} price moved {direction}",
            message=f"{analysis.symbol} moved {move_percent:.2f}% since the last alert snapshot.",
            priority=70 + int(round(move_percent)),
        )

    def _price_move_percent(self, previous_price: float, current_price: float) -> float:
        if previous_price <= 0:
            return 0.0
        return abs(((current_price - previous_price) / previous_price) * 100)

    def _row_to_schema(self, row) -> AnalysisAlert:
        return AnalysisAlert(
            symbol=row.symbol,
            strategy=row.strategy,
            kind=row.kind,
            tone=row.tone,
            title=row.title,
            message=row.message,
            priority=row.priority,
            recommendation=row.recommendation,
            data_quality=row.data_quality,
            price=row.price,
            change_percent=row.change_percent,
            is_favorite=row.is_favorite,
            created_at=row.created_at,
        )
