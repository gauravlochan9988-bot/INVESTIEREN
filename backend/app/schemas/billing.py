from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class CheckoutSessionResponse(BaseModel):
    url: str
    session_id: str


class SubscriptionStatusResponse(BaseModel):
    active: bool
    status: str
    plan_name: str
    amount_cents: int
    currency: str
    interval: str
    cancel_at_period_end: bool
    current_period_end: Optional[datetime] = None


class BillingSyncResponse(BaseModel):
    status: str
    subscription_status: str
