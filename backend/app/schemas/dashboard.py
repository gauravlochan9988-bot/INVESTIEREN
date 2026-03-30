from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class DashboardWatchlistItem(BaseModel):
    symbol: str
    name: str
    exchange: Optional[str] = None
    logo: Optional[str] = None
    price: float
    change_percent: float
    high: float
    low: float
    open: float
    previous_close: float


class DashboardSymbolOverview(BaseModel):
    symbol: str
    name: str
    exchange: Optional[str] = None
    finnhub_industry: Optional[str] = None
    ipo: Optional[str] = None
    logo: Optional[str] = None
    weburl: Optional[str] = None
    market_capitalization: Optional[float] = None
    share_outstanding: Optional[float] = None
    price: float
    change_percent: float
    high: float
    low: float
    open: float
    previous_close: float


class DashboardNewsItem(BaseModel):
    headline: str
    source: Optional[str] = None
    summary: Optional[str] = None
    url: str
    image: Optional[str] = None
    published_at: datetime
