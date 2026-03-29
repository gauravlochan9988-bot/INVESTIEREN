from __future__ import annotations

from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundError, ValidationError
from app.models.portfolio_position import PortfolioPosition
from app.repositories.portfolio import PortfolioRepository
from app.schemas.portfolio import PortfolioResponse, PositionCreate, PositionResponse, PositionUpdate
from app.services.market_data import MarketDataService


class PortfolioService:
    def __init__(
        self,
        market_data_service: MarketDataService,
        portfolio_repository: PortfolioRepository,
    ):
        self.market_data_service = market_data_service
        self.portfolio_repository = portfolio_repository

    def get_portfolio(self, db: Session, force_refresh: bool = False) -> PortfolioResponse:
        positions = self.portfolio_repository.list_positions(db)
        if not positions:
            return PortfolioResponse(
                positions=[],
                cost_basis=0.0,
                market_value=0.0,
                total_pnl=0.0,
                total_pnl_percent=0.0,
            )

        quotes = {
            quote.symbol: quote
            for quote in self.market_data_service.get_watchlist_quotes(
                force_refresh=force_refresh
            )
        }
        position_rows = []
        total_cost_basis = 0.0
        total_market_value = 0.0

        for position in positions:
            quote = quotes.get(position.symbol)
            if quote is None:
                raise NotFoundError(f"No live quote found for portfolio symbol {position.symbol}.")
            cost_basis = round(position.quantity * position.average_price, 2)
            market_value = round(position.quantity * quote.price, 2)
            pnl = round(market_value - cost_basis, 2)
            pnl_percent = round((pnl / cost_basis * 100), 2) if cost_basis else 0.0
            total_cost_basis += cost_basis
            total_market_value += market_value

            position_rows.append(
                PositionResponse(
                    id=position.id,
                    symbol=position.symbol,
                    quantity=position.quantity,
                    average_price=position.average_price,
                    opened_at=position.opened_at,
                    current_price=quote.price,
                    market_value=market_value,
                    cost_basis=cost_basis,
                    pnl=pnl,
                    pnl_percent=pnl_percent,
                    updated_at=quote.updated_at,
                )
            )

        total_pnl = round(total_market_value - total_cost_basis, 2)
        total_pnl_percent = (
            round((total_pnl / total_cost_basis * 100), 2) if total_cost_basis else 0.0
        )
        return PortfolioResponse(
            positions=position_rows,
            cost_basis=round(total_cost_basis, 2),
            market_value=round(total_market_value, 2),
            total_pnl=total_pnl,
            total_pnl_percent=total_pnl_percent,
        )

    def create_position(self, db: Session, payload: PositionCreate) -> PositionResponse:
        symbol = self.market_data_service.ensure_supported_symbol(payload.symbol)
        self._validate_numeric_fields(payload.quantity, payload.average_price)
        position = PortfolioPosition(
            symbol=symbol,
            quantity=payload.quantity,
            average_price=payload.average_price,
            opened_at=payload.opened_at,
        )
        saved_position = self.portfolio_repository.save(db, position)
        return self._get_position_snapshot(db, saved_position.id)

    def update_position(
        self, db: Session, position_id: int, payload: PositionUpdate
    ) -> PositionResponse:
        position = self.portfolio_repository.get_position(db, position_id)
        if position is None:
            raise NotFoundError(f"Portfolio position {position_id} was not found.")

        next_quantity = payload.quantity if payload.quantity is not None else position.quantity
        next_average_price = (
            payload.average_price
            if payload.average_price is not None
            else position.average_price
        )
        self._validate_numeric_fields(next_quantity, next_average_price)

        if payload.quantity is not None:
            position.quantity = payload.quantity
        if payload.average_price is not None:
            position.average_price = payload.average_price
        if payload.opened_at is not None:
            position.opened_at = payload.opened_at

        saved_position = self.portfolio_repository.save(db, position)
        return self._get_position_snapshot(db, saved_position.id)

    def delete_position(self, db: Session, position_id: int) -> None:
        position = self.portfolio_repository.get_position(db, position_id)
        if position is None:
            raise NotFoundError(f"Portfolio position {position_id} was not found.")
        self.portfolio_repository.delete(db, position)

    def _validate_numeric_fields(self, quantity: float, average_price: float) -> None:
        if quantity <= 0:
            raise ValidationError("Quantity must be greater than zero.")
        if average_price <= 0:
            raise ValidationError("Average price must be greater than zero.")

    def _get_position_snapshot(self, db: Session, position_id: int) -> PositionResponse:
        snapshot = self.get_portfolio(db)
        for position in snapshot.positions:
            if position.id == position_id:
                return position
        raise NotFoundError(f"Portfolio position {position_id} was not found after persistence.")
