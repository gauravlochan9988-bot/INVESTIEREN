from __future__ import annotations

from typing import Optional

from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from app.models.favorite_symbol import FavoriteSymbol


class FavoriteSymbolRepository:
    def _user_scope(self, *, user_key: str, app_user_id: Optional[int]):
        if app_user_id is not None:
            return or_(
                FavoriteSymbol.app_user_id == app_user_id,
                and_(FavoriteSymbol.app_user_id.is_(None), FavoriteSymbol.user_key == user_key),
            )
        return FavoriteSymbol.user_key == user_key

    def list_entries(
        self,
        db: Session,
        *,
        user_key: str,
        app_user_id: Optional[int] = None,
    ) -> list[FavoriteSymbol]:
        statement = (
            select(FavoriteSymbol)
            .where(self._user_scope(user_key=user_key, app_user_id=app_user_id))
            .order_by(FavoriteSymbol.created_at.asc(), FavoriteSymbol.id.asc())
        )
        return list(db.scalars(statement).all())

    def list_symbols(
        self,
        db: Session,
        *,
        user_key: str,
        app_user_id: Optional[int] = None,
    ) -> list[str]:
        return [row.symbol for row in self.list_entries(db, user_key=user_key, app_user_id=app_user_id)]

    def get_app_user_id_for_user_key(self, db: Session, *, user_key: str) -> Optional[int]:
        row = db.scalar(
            select(FavoriteSymbol.app_user_id)
            .where(FavoriteSymbol.user_key == user_key, FavoriteSymbol.app_user_id.is_not(None))
            .limit(1)
        )
        return int(row) if row is not None else None

    def list_distinct_user_keys(self, db: Session) -> list[str]:
        statement = select(FavoriteSymbol.user_key).distinct()
        rows = db.execute(statement).all()
        return sorted({str(row[0]) for row in rows if row[0]})

    def create(
        self,
        db: Session,
        *,
        user_key: str,
        symbol: str,
        app_user_id: Optional[int] = None,
    ) -> FavoriteSymbol:
        existing = db.scalar(
            select(FavoriteSymbol).where(
                self._user_scope(user_key=user_key, app_user_id=app_user_id),
                FavoriteSymbol.symbol == symbol,
            )
        )
        if existing is not None:
            if app_user_id is not None and existing.app_user_id is None:
                existing.app_user_id = app_user_id
                db.commit()
                db.refresh(existing)
            return existing
        row = FavoriteSymbol(user_key=user_key, symbol=symbol, app_user_id=app_user_id)
        db.add(row)
        db.commit()
        db.refresh(row)
        return row

    def delete(
        self,
        db: Session,
        *,
        user_key: str,
        symbol: str,
        app_user_id: Optional[int] = None,
    ) -> bool:
        existing = db.scalar(
            select(FavoriteSymbol).where(
                self._user_scope(user_key=user_key, app_user_id=app_user_id),
                FavoriteSymbol.symbol == symbol,
            )
        )
        if existing is None:
            return False
        db.delete(existing)
        db.commit()
        return True
