from __future__ import annotations

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models.favorite_symbol import FavoriteSymbol


class FavoriteSymbolRepository:
    def list_entries(self, db: Session, *, user_key: str) -> list[FavoriteSymbol]:
        statement = (
            select(FavoriteSymbol)
            .where(FavoriteSymbol.user_key == user_key)
            .order_by(FavoriteSymbol.created_at.asc(), FavoriteSymbol.id.asc())
        )
        return list(db.scalars(statement).all())

    def list_symbols(self, db: Session, *, user_key: str) -> list[str]:
        return [row.symbol for row in self.list_entries(db, user_key=user_key)]

    def create(self, db: Session, *, user_key: str, symbol: str) -> FavoriteSymbol:
        existing = db.scalar(
            select(FavoriteSymbol).where(
                FavoriteSymbol.user_key == user_key,
                FavoriteSymbol.symbol == symbol,
            )
        )
        if existing is not None:
            return existing
        row = FavoriteSymbol(user_key=user_key, symbol=symbol)
        db.add(row)
        db.commit()
        db.refresh(row)
        return row

    def delete(self, db: Session, *, user_key: str, symbol: str) -> bool:
        existing = db.scalar(
            select(FavoriteSymbol).where(
                FavoriteSymbol.user_key == user_key,
                FavoriteSymbol.symbol == symbol,
            )
        )
        if existing is None:
            return False
        db.delete(existing)
        db.commit()
        return True
