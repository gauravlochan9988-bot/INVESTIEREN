from __future__ import annotations

from datetime import date, datetime, timezone
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, computed_field, model_validator

from app.schemas.analysis import Strategy


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


class PositionClose(BaseModel):
    strategy: Strategy = "hedgefund"
    exit_price: Optional[float] = None
    closed_at: Optional[datetime] = None
    recommendation: Optional[str] = None
    score: Optional[int] = None
    confidence: Optional[float] = None
    data_quality: Optional[str] = None

    @model_validator(mode="after")
    def hydrate_defaults(self) -> "PositionClose":
        if self.closed_at is None:
            self.closed_at = datetime.now(timezone.utc)
        elif self.closed_at.tzinfo is None:
            self.closed_at = self.closed_at.replace(tzinfo=timezone.utc)
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


class TradePerformanceResponse(BaseModel):
    id: int
    symbol: str
    strategy: Strategy
    learning_version: str
    quantity: float
    entry_price: float
    exit_price: Optional[float] = None
    recommendation: Optional[str] = None
    score: Optional[int] = None
    confidence: Optional[float] = None
    data_quality: Optional[str] = None
    profit_loss: Optional[float] = None
    duration: Optional[float] = None
    opened_at: date
    closed_at: datetime
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
