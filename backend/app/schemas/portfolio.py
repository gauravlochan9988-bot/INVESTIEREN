from __future__ import annotations

from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict


class PositionCreate(BaseModel):
    symbol: str
    quantity: float
    average_price: float
    opened_at: date


class PositionUpdate(BaseModel):
    quantity: Optional[float] = None
    average_price: Optional[float] = None
    opened_at: Optional[date] = None


class PositionResponse(BaseModel):
    id: int
    symbol: str
    quantity: float
    average_price: float
    opened_at: date
    current_price: float
    market_value: float
    cost_basis: float
    pnl: float
    pnl_percent: float
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PortfolioResponse(BaseModel):
    positions: List[PositionResponse]
    cost_basis: float
    market_value: float
    total_pnl: float
    total_pnl_percent: float
