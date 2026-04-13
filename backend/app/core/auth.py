from __future__ import annotations

from datetime import datetime, timedelta, timezone
import logging
from typing import Any, Dict, Optional

import httpx
from fastapi import HTTPException, status
from jose import JWTError, jwt

logger = logging.getLogger(__name__)


class ClerkTokenVerifier:
    def __init__(
        self,
        *,
        jwt_key: str,
        secret_key: str = "",
        publishable_key: str = "",
        supabase_url: str = "",
        supabase_anon_key: str = "",
        authorized_parties: Optional[list[str]] = None,
        timeout_seconds: float = 2.0,
    ) -> None:
        self.jwt_key = jwt_key.strip()
        self.secret_key = secret_key.strip()
        self.publishable_key = publishable_key.strip()
        self.supabase_url = supabase_url.strip().rstrip("/")
        self.supabase_anon_key = supabase_anon_key.strip()
        self.authorized_parties = [
            party.strip().rstrip("/") for party in (authorized_parties or []) if party.strip()
        ]
        self.timeout_seconds = timeout_seconds

    def _credentials_error(self, message: str = "Authentication required.") -> HTTPException:
        return HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=message,
            headers={"WWW-Authenticate": "Bearer"},
        )

    def _configuration_error(self) -> HTTPException:
        return HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication is not configured.",
        )

    @property
    def enabled(self) -> bool:
        clerk_enabled = bool(self.publishable_key and (self.jwt_key or self.secret_key))
        supabase_enabled = bool(self.supabase_url and self.supabase_anon_key)
        return clerk_enabled or supabase_enabled

    @property
    def provider(self) -> str:
        if self.supabase_url and self.supabase_anon_key:
            return "supabase"
        return "clerk"

    def _check_authorized_party(self, claims: Dict[str, Any]) -> None:
        if not self.authorized_parties:
            return

        azp = str(claims.get("azp") or "").rstrip("/")
        if azp and azp not in self.authorized_parties:
            logger.warning(
                "Clerk auth rejected due to unauthorized azp claim.",
                extra={"auth_reason": "unauthorized_party", "azp": azp, "allowed": self.authorized_parties},
            )
            raise self._credentials_error("Token origin is not allowed.")

    def _verify_with_jwt_key(self, token: str) -> Dict[str, Any]:
        try:
            claims = jwt.decode(
                token,
                self.jwt_key,
                algorithms=["RS256"],
                options={"verify_aud": False},
            )
        except JWTError as exc:
            logger.warning(
                "Clerk auth failed while verifying JWT with CLERK_JWT_KEY.",
                extra={"auth_reason": "jwt_verification_failed", "error": str(exc)},
            )
            raise self._credentials_error("Invalid or expired token.") from exc
        self._check_authorized_party(claims)
        return claims

    def _verify_with_secret_key(self, token: str) -> Dict[str, Any]:
        headers = {
            "Authorization": f"Bearer {self.secret_key}",
            "Content-Type": "application/json",
        }
        payload: Dict[str, Any] = {"token": token}
        if self.authorized_parties:
            payload["authorized_parties"] = self.authorized_parties

        try:
            response = httpx.post(
                "https://api.clerk.com/v1/sessions/verify",
                headers=headers,
                json=payload,
                timeout=self.timeout_seconds,
            )
        except httpx.HTTPError as exc:
            logger.error(
                "Clerk auth verification request failed.",
                extra={"auth_reason": "clerk_verify_network_error", "error": str(exc)},
            )
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Authentication service is temporarily unavailable.",
            ) from exc

        if response.status_code >= 400:
            detail = ""
            try:
                body = response.json()
                detail = str(body.get("errors") or body.get("message") or body)
            except ValueError:
                detail = response.text
            logger.warning(
                "Clerk auth rejected by verify endpoint.",
                extra={
                    "auth_reason": "clerk_verify_rejected",
                    "status_code": response.status_code,
                    "detail": detail[:600],
                },
            )
            raise self._credentials_error("Invalid or expired token.")

        try:
            claims = jwt.get_unverified_claims(token)
        except JWTError as exc:
            logger.warning(
                "Clerk verify succeeded but token claims were unreadable.",
                extra={"auth_reason": "token_claims_unreadable", "error": str(exc)},
            )
            raise self._credentials_error("Invalid or expired token.") from exc
        self._check_authorized_party(claims)
        return claims

    def _verify_with_supabase(self, token: str) -> Dict[str, Any]:
        if not self.supabase_url or not self.supabase_anon_key:
            raise self._configuration_error()

        headers = {
            "Authorization": f"Bearer {token}",
            "apikey": self.supabase_anon_key,
        }
        try:
            response = httpx.get(
                f"{self.supabase_url}/auth/v1/user",
                headers=headers,
                timeout=self.timeout_seconds,
            )
        except httpx.HTTPError as exc:
            logger.error(
                "Supabase auth verification request failed.",
                extra={"auth_reason": "supabase_verify_network_error", "error": str(exc)},
            )
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Authentication service is temporarily unavailable.",
            ) from exc

        if response.status_code >= 400:
            detail = ""
            try:
                body = response.json()
                detail = str(body.get("msg") or body.get("error_description") or body)
            except ValueError:
                detail = response.text
            logger.warning(
                "Supabase auth rejected by user endpoint.",
                extra={
                    "auth_reason": "supabase_verify_rejected",
                    "status_code": response.status_code,
                    "detail": detail[:600],
                },
            )
            raise self._credentials_error("Invalid or expired token.")

        try:
            user = response.json()
        except ValueError as exc:
            logger.warning(
                "Supabase verify returned invalid JSON.",
                extra={"auth_reason": "supabase_user_unreadable"},
            )
            raise self._credentials_error("Invalid or expired token.") from exc

        user_metadata = user.get("user_metadata") or {}
        app_metadata = user.get("app_metadata") or {}
        claims: Dict[str, Any] = {
            "sub": user.get("id"),
            "email": user.get("email"),
            "name": user_metadata.get("name") or user_metadata.get("full_name"),
            "full_name": user_metadata.get("full_name") or user_metadata.get("name"),
            "username": user_metadata.get("user_name") or user_metadata.get("username"),
            "picture": user_metadata.get("avatar_url") or user_metadata.get("picture"),
            "provider": app_metadata.get("provider") or "supabase",
        }
        return claims

    def verify(self, token: str) -> Dict[str, Any]:
        if not self.enabled:
            logger.error(
                "Clerk auth is not configured: missing publishable key or verification key.",
                extra={
                    "auth_reason": "auth_not_configured",
                    "has_publishable_key": bool(self.publishable_key),
                    "has_jwt_key": bool(self.jwt_key),
                    "has_secret_key": bool(self.secret_key),
                },
            )
            raise self._configuration_error()

        if self.provider == "supabase":
            return self._verify_with_supabase(token)

        # Prefer secret-key verification when available. This avoids hard failures
        # from stale CLERK_JWT_KEY values and matches Clerk's recommended server flow.
        if self.secret_key:
            try:
                return self._verify_with_secret_key(token)
            except HTTPException as secret_exc:
                if secret_exc.status_code == status.HTTP_503_SERVICE_UNAVAILABLE and self.jwt_key:
                    logger.warning(
                        "Clerk secret-key verification unavailable, falling back to JWT key.",
                        extra={"auth_reason": "secret_verify_unavailable_fallback_jwt"},
                    )
                    return self._verify_with_jwt_key(token)
                raise
        if self.jwt_key:
            return self._verify_with_jwt_key(token)
        logger.error(
            "Clerk auth verifier was enabled but no JWT or secret key was available.",
            extra={"auth_reason": "missing_verifier_key"},
        )
        raise self._configuration_error()


def extract_bearer_token(authorization: Optional[str]) -> str:
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Authorization header.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return token.strip()


class AdminSessionManager:
    def __init__(self, *, secret: str, ttl_seconds: int = 60 * 60 * 12) -> None:
        self.secret = secret.strip()
        self.ttl_seconds = ttl_seconds

    @property
    def enabled(self) -> bool:
        return bool(self.secret)

    def create(self, *, auth_subject: str, provider: str = "admin_access") -> str:
        if not self.enabled:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Admin access is not configured.",
            )

        now = datetime.now(timezone.utc)
        payload = {
            "sub": auth_subject,
            "provider": provider,
            "is_admin": True,
            "iat": int(now.timestamp()),
            "exp": int((now + timedelta(seconds=self.ttl_seconds)).timestamp()),
        }
        return jwt.encode(payload, self.secret, algorithm="HS256")

    def verify(self, token: str) -> Dict[str, Any]:
        if not self.enabled:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Admin access is not configured.",
            )

        try:
            claims = jwt.decode(token, self.secret, algorithms=["HS256"])
        except JWTError as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid admin session.",
                headers={"WWW-Authenticate": "Bearer"},
            ) from exc

        if not claims.get("is_admin"):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid admin session.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return claims
