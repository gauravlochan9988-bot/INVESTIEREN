from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_portfolio_service, require_full_access_user_context
from app.core.database import get_db
from app.schemas.portfolio import (
    PortfolioResponse,
    PositionClose,
    PositionCreate,
    PositionResponse,
    PositionUpdate,
    TradePerformanceResponse,
)
from app.services.portfolio import PortfolioService

router = APIRouter(
    prefix="/portfolio",
    tags=["portfolio"],
    dependencies=[Depends(require_full_access_user_context)],
)


@router.get("", response_model=PortfolioResponse)
def get_portfolio(
    refresh: bool = Query(default=False),
    db: Session = Depends(get_db),
    portfolio_service: PortfolioService = Depends(get_portfolio_service),
) -> PortfolioResponse:
    return portfolio_service.get_portfolio(db, force_refresh=refresh)


@router.post("/positions", response_model=PositionResponse, status_code=status.HTTP_201_CREATED)
def create_position(
    payload: PositionCreate,
    db: Session = Depends(get_db),
    portfolio_service: PortfolioService = Depends(get_portfolio_service),
) -> PositionResponse:
    return portfolio_service.create_position(db, payload)


@router.get("/trades", response_model=list[TradePerformanceResponse])
def get_closed_trades(
    limit: int = Query(default=200, ge=1, le=500),
    db: Session = Depends(get_db),
    portfolio_service: PortfolioService = Depends(get_portfolio_service),
) -> list[TradePerformanceResponse]:
    return portfolio_service.list_closed_trades(db, limit=limit)


@router.patch("/positions/{position_id}", response_model=PositionResponse)
def update_position(
    position_id: int,
    payload: PositionUpdate,
    db: Session = Depends(get_db),
    portfolio_service: PortfolioService = Depends(get_portfolio_service),
) -> PositionResponse:
    return portfolio_service.update_position(db, position_id, payload)


@router.post(
    "/positions/{position_id}/close",
    response_model=TradePerformanceResponse,
    status_code=status.HTTP_200_OK,
)
def close_position(
    position_id: int,
    payload: PositionClose,
    db: Session = Depends(get_db),
    portfolio_service: PortfolioService = Depends(get_portfolio_service),
) -> TradePerformanceResponse:
    return portfolio_service.close_position(db, position_id, payload)


@router.delete("/positions/{position_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_position(
    position_id: int,
    db: Session = Depends(get_db),
    portfolio_service: PortfolioService = Depends(get_portfolio_service),
) -> Response:
    portfolio_service.delete_position(db, position_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
