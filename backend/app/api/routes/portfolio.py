from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_portfolio_service
from app.core.database import get_db
from app.schemas.portfolio import PortfolioResponse, PositionCreate, PositionResponse, PositionUpdate
from app.services.portfolio import PortfolioService

router = APIRouter(prefix="/portfolio", tags=["portfolio"])


@router.get("", response_model=PortfolioResponse)
def get_portfolio(
    db: Session = Depends(get_db),
    portfolio_service: PortfolioService = Depends(get_portfolio_service),
) -> PortfolioResponse:
    return portfolio_service.get_portfolio(db)


@router.post("/positions", response_model=PositionResponse, status_code=status.HTTP_201_CREATED)
def create_position(
    payload: PositionCreate,
    db: Session = Depends(get_db),
    portfolio_service: PortfolioService = Depends(get_portfolio_service),
) -> PositionResponse:
    return portfolio_service.create_position(db, payload)


@router.patch("/positions/{position_id}", response_model=PositionResponse)
def update_position(
    position_id: int,
    payload: PositionUpdate,
    db: Session = Depends(get_db),
    portfolio_service: PortfolioService = Depends(get_portfolio_service),
) -> PositionResponse:
    return portfolio_service.update_position(db, position_id, payload)


@router.delete("/positions/{position_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_position(
    position_id: int,
    db: Session = Depends(get_db),
    portfolio_service: PortfolioService = Depends(get_portfolio_service),
) -> Response:
    portfolio_service.delete_position(db, position_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
