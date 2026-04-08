from typing import Optional

from pydantic import BaseModel


class AuthConfigResponse(BaseModel):
    enabled: bool
    provider: Optional[str] = None
    publishable_key: Optional[str] = None
    frontend_api_url: Optional[str] = None


class AppUserResponse(BaseModel):
    id: int
    auth_subject: str
    provider: str
    email: Optional[str] = None
    name: Optional[str] = None
    picture_url: Optional[str] = None
