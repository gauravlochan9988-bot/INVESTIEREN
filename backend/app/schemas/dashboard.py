from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class DashboardWatchlistItem(BaseModel):
    symbol: str
    name: str
    exchange: Optional[str] = None
    logo: Optional[str] = None
    price: Optional[float] = None
    change_percent: Optional[float] = None
    high: Optional[float] = None
    low: Optional[float] = None
    open: Optional[float] = None
    previous_close: Optional[float] = None
    stale: bool = False
    no_data: bool = False


class DashboardSymbolOverview(BaseModel):
    symbol: str
    name: str
    data_quality: str = "FULL"
    exchange: Optional[str] = None
    finnhub_industry: Optional[str] = None
    ipo: Optional[str] = None
    logo: Optional[str] = None
    weburl: Optional[str] = None
    market_capitalization: Optional[float] = None
    share_outstanding: Optional[float] = None
    price: Optional[float] = None
    change_percent: Optional[float] = None
    high: Optional[float] = None
    low: Optional[float] = None
    open: Optional[float] = None
    previous_close: Optional[float] = None
    stale: bool = False
    no_data: bool = False


class DashboardNewsItem(BaseModel):
    headline: str
    source: Optional[str] = None
    summary: Optional[str] = None
    url: str
    image: Optional[str] = None
    published_at: datetime
