from base64 import urlsafe_b64decode
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_app_user_repository, get_clerk_verifier
from app.core.auth import ClerkTokenVerifier, extract_bearer_token
from app.core.config import get_settings
from app.core.database import get_db
from app.repositories.app_user import AppUserRepository
from app.schemas.auth import AppUserResponse, AuthConfigResponse


router = APIRouter(prefix="/auth", tags=["auth"])


def _derive_clerk_frontend_api_url(publishable_key: str) -> Optional[str]:
    value = (publishable_key or "").strip()
    if not value or "$" not in value:
        return None

    encoded = value.split("$", 1)[0].split("_", 2)[-1]
    padding = "=" * (-len(encoded) % 4)
    try:
        decoded = urlsafe_b64decode(f"{encoded}{padding}".encode("utf-8")).decode("utf-8").strip()
    except Exception:
        return None

    if not decoded:
        return None
    return decoded if decoded.startswith("https://") else f"https://{decoded}"


@router.get("/config", response_model=AuthConfigResponse)
def get_auth_config() -> AuthConfigResponse:
    settings = get_settings()
    frontend_api_url = settings.clerk_frontend_api_url.strip() or _derive_clerk_frontend_api_url(
        settings.clerk_publishable_key
    )
    enabled = bool(
        settings.clerk_publishable_key.strip()
        and frontend_api_url
        and settings.clerk_jwt_key.strip()
    )
    return AuthConfigResponse(
        enabled=enabled,
        provider="clerk" if enabled else None,
        publishable_key=settings.clerk_publishable_key.strip() or None,
        frontend_api_url=frontend_api_url,
        plan_slug=settings.clerk_plan_slug.strip() or None,
        plan_name=settings.clerk_plan_name.strip() or None,
        plan_amount_cents=499,
        plan_currency="eur",
        plan_interval="month",
    )


@router.get("/me", response_model=AppUserResponse)
def get_current_user(
    authorization: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
    verifier: ClerkTokenVerifier = Depends(get_clerk_verifier),
    app_user_repository: AppUserRepository = Depends(get_app_user_repository),
) -> AppUserResponse:
    token = extract_bearer_token(authorization)
    claims = verifier.verify(token)
    auth_subject = str(claims.get("sub") or "").strip()
    if not auth_subject:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing subject claim.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user = app_user_repository.upsert_from_claims(
        db,
        auth_subject=auth_subject,
        provider="clerk",
        email=(claims.get("email") or None),
        name=(claims.get("full_name") or claims.get("name") or claims.get("username") or None),
        picture_url=(claims.get("image_url") or claims.get("picture") or None),
    )
    return AppUserResponse.model_validate(user, from_attributes=True)
