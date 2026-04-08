from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field, computed_field, model_validator


class StockQuote(BaseModel):
    symbol: str
    name: str
    price: Optional[float] = None
    change_percent: float
    volume: int = 0
    updated_at: datetime
    stale: bool = False
    no_data: bool = False

    @computed_field
    @property
    def change(self) -> float:
        return self.change_percent

    @computed_field
    @property
    def timestamp(self) -> datetime:
        return self.updated_at


class HistoryPoint(BaseModel):
    date: datetime
    open: Optional[float] = None
    high: Optional[float] = None
    low: Optional[float] = None
    close: float
    volume: int = 0

    @model_validator(mode="after")
    def hydrate_ohl_fields(self) -> "HistoryPoint":
        if self.open is None:
            self.open = self.close
        if self.high is None:
            self.high = self.close
        if self.low is None:
            self.low = self.close
        return self

    @computed_field
    @property
    def O(self) -> float:
        return self.open if self.open is not None else self.close

    @computed_field
    @property
    def H(self) -> float:
        return self.high if self.high is not None else self.close

    @computed_field
    @property
    def L(self) -> float:
        return self.low if self.low is not None else self.close

    @computed_field
    @property
    def C(self) -> float:
        return self.close

    @computed_field
    @property
    def V(self) -> int:
        return self.volume


class StockHistoryResponse(BaseModel):
    symbol: str
    range: str = Field(alias="range")
    points: List[HistoryPoint]

    model_config = {"populate_by_name": True}
