from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class AdminUserAccessLookupResponse(BaseModel):
    found: bool
    email: str
    app_user_id: Optional[int] = None
    auth_subject: Optional[str] = None
    name: Optional[str] = None
    role: Optional[str] = None
    plan: Optional[str] = None
    subscription_status: Optional[str] = None
    message: Optional[str] = None


class AdminUserAccessUpdateRequest(BaseModel):
    email: str


class AdminUserAccessUpdateResponse(BaseModel):
    status: str
    user: AdminUserAccessLookupResponse
    message: str
