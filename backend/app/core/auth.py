from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import HTTPException, status
from jose import JWTError, jwt


class ClerkTokenVerifier:
    def __init__(self, *, jwt_key: str, authorized_party: str = "", timeout_seconds: float = 2.0) -> None:
        self.jwt_key = jwt_key.strip()
        self.authorized_party = authorized_party.strip().rstrip("/")
        self.timeout_seconds = timeout_seconds
        self._jwks_cache: Dict[str, Any] = {"keys": None, "expires_at": 0.0}

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
        return bool(self.jwt_key)

    def verify(self, token: str) -> Dict[str, Any]:
        if not self.enabled:
            raise self._configuration_error()

        try:
            claims = jwt.decode(
                token,
                self.jwt_key,
                algorithms=["RS256"],
                options={"verify_aud": False},
            )
        except JWTError as exc:
            raise self._credentials_error("Invalid or expired token.") from exc

        azp = str(claims.get("azp") or "").rstrip("/")
        if self.authorized_party and azp and azp != self.authorized_party:
            raise self._credentials_error("Token origin is not allowed.")
        return claims


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
