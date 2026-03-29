from __future__ import annotations

from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, computed_field, model_validator


class PositionCreate(BaseModel):
    symbol: str
    quantity: float
    average_price: Optional[float] = None
    opened_at: Optional[date] = None
    entry_price: Optional[float] = None

    @model_validator(mode="after")
    def hydrate_aliases(self) -> "PositionCreate":
        if self.average_price is None:
            self.average_price = self.entry_price
        if self.opened_at is None:
            self.opened_at = date.today()
        return self


class PositionUpdate(BaseModel):
    quantity: Optional[float] = None
    average_price: Optional[float] = None
    opened_at: Optional[date] = None
    entry_price: Optional[float] = None

    @model_validator(mode="after")
    def hydrate_aliases(self) -> "PositionUpdate":
        if self.average_price is None and self.entry_price is not None:
            self.average_price = self.entry_price
        return self


class PositionResponse(BaseModel):
    id: int
    symbol: str
    quantity: float
    average_price: float
    entry_price: Optional[float] = None
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

    @computed_field
    @property
    def aggregated_pnl(self) -> float:
        return self.total_pnl

    @computed_field
    @property
    def pnl(self) -> float:
        return self.total_pnl
