from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.portfolio_position import PortfolioPosition


class PortfolioRepository:
    def list_positions(self, db: Session) -> list[PortfolioPosition]:
        statement = select(PortfolioPosition).order_by(PortfolioPosition.id.asc())
        return list(db.scalars(statement).all())

    def get_position(self, db: Session, position_id: int) -> PortfolioPosition | None:
        return db.get(PortfolioPosition, position_id)

    def save(self, db: Session, position: PortfolioPosition) -> PortfolioPosition:
        db.add(position)
        db.commit()
        db.refresh(position)
        return position

    def delete(self, db: Session, position: PortfolioPosition) -> None:
        db.delete(position)
        db.commit()
