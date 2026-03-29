from datetime import datetime
from typing import List

from pydantic import BaseModel, Field


class StockQuote(BaseModel):
    symbol: str
    name: str
    price: float
    change_percent: float
    volume: int = 0
    updated_at: datetime


class HistoryPoint(BaseModel):
    date: datetime
    close: float


class StockHistoryResponse(BaseModel):
    symbol: str
    range: str = Field(alias="range")
    points: List[HistoryPoint]

    model_config = {"populate_by_name": True}
