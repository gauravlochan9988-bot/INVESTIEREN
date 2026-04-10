from __future__ import annotations

from typing import Optional

from sqlalchemy import and_, delete, or_, select
from sqlalchemy.orm import Session

from app.models.alert_event import AlertEvent
from app.models.alert_state import AlertState


class AlertRepository:
    def _event_scope(self, *, user_key: str, app_user_id: Optional[int]):
        if app_user_id is not None:
            return or_(
                AlertEvent.app_user_id == app_user_id,
                and_(AlertEvent.app_user_id.is_(None), AlertEvent.user_key == user_key),
            )
        return AlertEvent.user_key == user_key

    def _state_scope(self, *, user_key: str, app_user_id: Optional[int]):
        if app_user_id is not None:
            return or_(
                AlertState.app_user_id == app_user_id,
                and_(AlertState.app_user_id.is_(None), AlertState.user_key == user_key),
            )
        return AlertState.user_key == user_key

    def create_event(
        self,
        db: Session,
        *,
        user_key: str,
        app_user_id: Optional[int] = None,
        symbol: str,
        strategy: str,
        kind: str,
        tone: str,
        title: str,
        message: str,
        priority: int,
        recommendation: str | None,
        data_quality: str,
        price: float | None,
        change_percent: float | None,
        is_favorite: bool,
        commit: bool = True,
    ) -> AlertEvent:
        event = AlertEvent(
            user_key=user_key,
            app_user_id=app_user_id,
            symbol=symbol,
            strategy=strategy,
            kind=kind,
            tone=tone,
            title=title,
            message=message,
            priority=priority,
            recommendation=recommendation,
            data_quality=data_quality,
            price=price,
            change_percent=change_percent,
            is_favorite=is_favorite,
        )
        db.add(event)
        if commit:
            db.commit()
            db.refresh(event)
        return event

    def list_recent_events(
        self,
        db: Session,
        *,
        user_key: str,
        app_user_id: Optional[int] = None,
        strategy: str,
        limit: int,
        favorites_only: bool = False,
    ) -> list[AlertEvent]:
        statement = (
            select(AlertEvent)
            .where(self._event_scope(user_key=user_key, app_user_id=app_user_id), AlertEvent.strategy == strategy)
            .order_by(AlertEvent.created_at.desc(), AlertEvent.priority.desc(), AlertEvent.id.desc())
            .limit(limit)
        )
        if favorites_only:
            statement = statement.where(AlertEvent.is_favorite.is_(True))
        return list(db.scalars(statement).all())

    def get_state(
        self,
        db: Session,
        *,
        user_key: str,
        app_user_id: Optional[int] = None,
        symbol: str,
        strategy: str,
    ) -> AlertState | None:
        statement = select(AlertState).where(
            self._state_scope(user_key=user_key, app_user_id=app_user_id),
            AlertState.symbol == symbol,
            AlertState.strategy == strategy,
        )
        return db.scalar(statement)

    def list_states_for_symbols(
        self,
        db: Session,
        *,
        user_key: str,
        app_user_id: Optional[int] = None,
        strategy: str,
        symbols: list[str],
    ) -> dict[str, AlertState]:
        if not symbols:
            return {}
        statement = select(AlertState).where(
            self._state_scope(user_key=user_key, app_user_id=app_user_id),
            AlertState.strategy == strategy,
            AlertState.symbol.in_(symbols),
        )
        rows = list(db.scalars(statement).all())
        return {row.symbol: row for row in rows}

    def save_state(
        self,
        db: Session,
        *,
        user_key: str,
        app_user_id: Optional[int] = None,
        symbol: str,
        strategy: str,
        price: float | None,
        recommendation: str | None,
        data_quality: str,
        confidence: float,
        is_favorite: bool,
        commit: bool = True,
    ) -> AlertState:
        state = self.get_state(
            db,
            user_key=user_key,
            app_user_id=app_user_id,
            symbol=symbol,
            strategy=strategy,
        )
        if state is None:
            state = AlertState(
                user_key=user_key,
                app_user_id=app_user_id,
                symbol=symbol,
                strategy=strategy,
            )
            db.add(state)
        state.last_price = price
        state.last_recommendation = recommendation
        state.last_data_quality = data_quality
        state.last_confidence = confidence
        state.is_favorite = is_favorite
        if app_user_id is not None:
            state.app_user_id = app_user_id
        if commit:
            db.commit()
            db.refresh(state)
        return state

    def clear_strategy_events(
        self,
        db: Session,
        *,
        user_key: str,
        app_user_id: Optional[int] = None,
        strategy: str,
    ) -> None:
        db.execute(
            delete(AlertEvent).where(
                self._event_scope(user_key=user_key, app_user_id=app_user_id),
                AlertEvent.strategy == strategy,
            )
        )
        db.commit()
