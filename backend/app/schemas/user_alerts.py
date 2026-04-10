from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.analysis import Strategy


AlertSignal = Literal["BUY", "SELL", "HOLD", "NO_DATA"]
NotificationStatus = Literal["unread", "read"]


class AlertRuleCreate(BaseModel):
    symbol: str
    strategy: Strategy = "hedgefund"
    enabled: bool = True
    notify_on_buy: bool = True
    notify_on_sell: bool = True
    min_confidence: float = Field(default=60.0, ge=0, le=100)


class AlertRuleUpdate(BaseModel):
    enabled: Optional[bool] = None
    notify_on_buy: Optional[bool] = None
    notify_on_sell: Optional[bool] = None
    min_confidence: Optional[float] = Field(default=None, ge=0, le=100)


class AlertRuleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    symbol: str
    strategy: Strategy
    enabled: bool
    notify_on_buy: bool
    notify_on_sell: bool
    min_confidence: float
    last_evaluated_signal: Optional[AlertSignal] = None
    last_notified_signal: Optional[AlertSignal] = None
    last_notified_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class NotificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    alert_rule_id: Optional[int] = None
    symbol: str
    strategy: Strategy
    signal: AlertSignal
    confidence: float
    title: str
    message: str
    status: NotificationStatus
    read_at: Optional[datetime] = None
    created_at: datetime


class MarkAllNotificationsReadResponse(BaseModel):
    updated: int


@dataclass(frozen=True)
class UserAlertScanSummary:
    rules_scanned: int
    notifications_created: int
    baseline_seeded: int
    skipped_no_data: int
