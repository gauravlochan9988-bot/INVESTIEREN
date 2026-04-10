from typing import Optional

from pydantic import BaseModel


class AuthConfigResponse(BaseModel):
    enabled: bool
    provider: Optional[str] = None
    publishable_key: Optional[str] = None
    frontend_api_url: Optional[str] = None
    plan_slug: Optional[str] = None
    plan_name: Optional[str] = None
    plan_amount_cents: Optional[int] = None
    plan_currency: Optional[str] = None
    plan_interval: Optional[str] = None


class AppUserResponse(BaseModel):
    id: int
    auth_subject: str
    provider: str
    email: Optional[str] = None
    name: Optional[str] = None
    picture_url: Optional[str] = None
    is_admin: bool = False
    role: str = "user"
    plan: str = "free"


class AdminAccessRequest(BaseModel):
    code: str


class AdminAccessResponse(BaseModel):
    session_token: str
    is_admin: bool = True
    user: AppUserResponse
