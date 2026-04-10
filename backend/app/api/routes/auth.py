from base64 import urlsafe_b64decode
import secrets
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.api.deps import (
    get_admin_session_manager,
    get_app_subscription_repository,
    get_app_user_repository,
    get_clerk_verifier,
)
from app.core.auth import AdminSessionManager, ClerkTokenVerifier, extract_bearer_token
from app.core.config import get_settings
from app.core.database import get_db
from app.repositories.app_user import AppUserRepository
from app.repositories.app_subscription import AppSubscriptionRepository
from app.schemas.auth import (
    AdminAccessRequest,
    AdminAccessResponse,
    AppUserResponse,
    AuthConfigResponse,
)
from app.services.cache import TTLCache


router = APIRouter(prefix="/auth", tags=["auth"])
_admin_attempt_cache: Optional[TTLCache[int]] = None
_admin_attempt_cache_ttl_seconds = 0


def _get_admin_attempt_cache(ttl_seconds: int) -> TTLCache[int]:
    global _admin_attempt_cache, _admin_attempt_cache_ttl_seconds
    normalized_ttl = max(1, int(ttl_seconds))
    if _admin_attempt_cache is None or _admin_attempt_cache_ttl_seconds != normalized_ttl:
        _admin_attempt_cache = TTLCache(ttl_seconds=normalized_ttl)
        _admin_attempt_cache_ttl_seconds = normalized_ttl
    return _admin_attempt_cache


def _serialize_user(
    user,
    *,
    is_admin: bool = False,
    role: str = "user",
    plan: str = "free",
) -> AppUserResponse:
    return AppUserResponse(
        id=user.id,
        auth_subject=user.auth_subject,
        provider=user.provider,
        email=user.email,
        name=user.name,
        picture_url=user.picture_url,
        is_admin=is_admin,
        role=role,
        plan=plan,
    )


def _derive_role_plan(
    *,
    user,
    is_admin: bool,
    settings,
    subscription_repository: AppSubscriptionRepository,
    db: Session,
) -> tuple[str, str]:
    owner_subjects = set(settings.get_owner_subjects())
    if is_admin or user.auth_subject in owner_subjects:
        return "owner", "pro"
    subscription = subscription_repository.get_by_user_id(db, app_user_id=user.id)
    if subscription and subscription.status in {"active", "trialing"}:
        return "user", "pro"
    return "user", "free"


def verify_access_code(code: str, expected_code: str) -> bool:
    submitted = str(code or "").strip()
    configured = str(expected_code or "").strip()
    return bool(configured) and secrets.compare_digest(submitted, configured)


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
        and (settings.clerk_jwt_key.strip() or settings.clerk_secret_key.strip())
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


@router.post("/access-code", response_model=AdminAccessResponse)
def create_admin_access_session(
    payload: AdminAccessRequest,
    request: Request,
    authorization: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
    settings = Depends(get_settings),
    verifier: ClerkTokenVerifier = Depends(get_clerk_verifier),
    admin_session_manager: AdminSessionManager = Depends(get_admin_session_manager),
    app_user_repository: AppUserRepository = Depends(get_app_user_repository),
    subscription_repository: AppSubscriptionRepository = Depends(get_app_subscription_repository),
) -> AdminAccessResponse:
    forwarded_for = request.headers.get("x-forwarded-for", "")
    client_ip = forwarded_for.split(",", 1)[0].strip() or (request.client.host if request.client else "unknown")
    attempt_cache = _get_admin_attempt_cache(settings.admin_access_lockout_seconds)
    attempts = attempt_cache.get(client_ip) or 0
    if attempts >= settings.admin_access_max_attempts:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many invalid access code attempts. Try again later.",
        )

    if not verify_access_code(payload.code, settings.admin_access_code):
        attempt_cache.set(client_ip, attempts + 1)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid access code.",
        )

    attempt_cache.delete(client_ip)

    auth_subject = "admin-access|local"
    provider = "admin_access"
    email = None
    name = "Admin Access"
    picture_url = None

    if authorization and verifier.enabled:
        token = extract_bearer_token(authorization)
        claims = verifier.verify(token)
        auth_subject = str(claims.get("sub") or "").strip() or auth_subject
        provider = "clerk"
        email = claims.get("email") or None
        name = claims.get("full_name") or claims.get("name") or claims.get("username") or name
        picture_url = claims.get("image_url") or claims.get("picture") or None

    user = app_user_repository.upsert_from_claims(
        db,
        auth_subject=auth_subject,
        provider=provider,
        email=email,
        name=name,
        picture_url=picture_url,
    )
    role, plan = _derive_role_plan(
        user=user,
        is_admin=True,
        settings=settings,
        subscription_repository=subscription_repository,
        db=db,
    )
    session_token = admin_session_manager.create(auth_subject=user.auth_subject, provider=user.provider)
    return AdminAccessResponse(
        session_token=session_token,
        user=_serialize_user(user, is_admin=True, role=role, plan=plan),
    )


@router.get("/me", response_model=AppUserResponse)
def get_current_user(
    authorization: Optional[str] = Header(default=None),
    x_admin_session: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
    verifier: ClerkTokenVerifier = Depends(get_clerk_verifier),
    admin_session_manager: AdminSessionManager = Depends(get_admin_session_manager),
    app_user_repository: AppUserRepository = Depends(get_app_user_repository),
    subscription_repository: AppSubscriptionRepository = Depends(get_app_subscription_repository),
    settings=Depends(get_settings),
) -> AppUserResponse:
    if x_admin_session and admin_session_manager.enabled:
        claims = admin_session_manager.verify(x_admin_session.strip())
        auth_subject = str(claims.get("sub") or "").strip()
        if not auth_subject:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid admin session.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        user = app_user_repository.get_by_subject(db, auth_subject=auth_subject)
        if user is None:
            user = app_user_repository.upsert_from_claims(
                db,
                auth_subject=auth_subject,
                provider=str(claims.get("provider") or "admin_access"),
                email=None,
                name="Admin Access",
                picture_url=None,
            )
        role, plan = _derive_role_plan(
            user=user,
            is_admin=True,
            settings=settings,
            subscription_repository=subscription_repository,
            db=db,
        )
        return _serialize_user(user, is_admin=True, role=role, plan=plan)

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
    role, plan = _derive_role_plan(
        user=user,
        is_admin=False,
        settings=settings,
        subscription_repository=subscription_repository,
        db=db,
    )
    return _serialize_user(user, is_admin=False, role=role, plan=plan)
