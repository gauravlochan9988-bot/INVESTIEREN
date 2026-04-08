from typing import Optional

from pydantic import BaseModel


class AuthConfigResponse(BaseModel):
    enabled: bool
    domain: Optional[str] = None
    client_id: Optional[str] = None
    audience: Optional[str] = None
    google_connection: Optional[str] = None
    apple_connection: Optional[str] = None


class AppUserResponse(BaseModel):
    id: int
    auth_subject: str
    provider: str
    email: Optional[str] = None
    name: Optional[str] = None
    picture_url: Optional[str] = None
