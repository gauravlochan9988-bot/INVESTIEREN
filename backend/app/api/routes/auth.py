from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_app_user_repository, get_auth0_verifier
from app.core.auth import Auth0TokenVerifier, extract_bearer_token
from app.core.config import get_settings
from app.core.database import get_db
from app.repositories.app_user import AppUserRepository
from app.schemas.auth import AppUserResponse, AuthConfigResponse


router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/config", response_model=AuthConfigResponse)
def get_auth_config() -> AuthConfigResponse:
    settings = get_settings()
    enabled = bool(
        settings.auth0_domain.strip()
        and settings.auth0_client_id.strip()
        and settings.auth0_audience.strip()
    )
    return AuthConfigResponse(
        enabled=enabled,
        domain=settings.auth0_domain.strip() or None,
        client_id=settings.auth0_client_id.strip() or None,
        audience=settings.auth0_audience.strip() or None,
        google_connection=settings.auth0_google_connection.strip() or None,
        apple_connection=settings.auth0_apple_connection.strip() or None,
    )


@router.get("/me", response_model=AppUserResponse)
def get_current_user(
    authorization: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
    verifier: Auth0TokenVerifier = Depends(get_auth0_verifier),
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
        email=(claims.get("email") or None),
        name=(claims.get("name") or claims.get("nickname") or None),
        picture_url=(claims.get("picture") or None),
    )
    return AppUserResponse.model_validate(user, from_attributes=True)
