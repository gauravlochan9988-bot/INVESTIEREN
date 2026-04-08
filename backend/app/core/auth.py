from __future__ import annotations

from time import time
from typing import Any, Dict, Optional

import httpx
from fastapi import HTTPException, status
from jose import JWTError, jwt


class Auth0TokenVerifier:
    def __init__(self, *, domain: str, audience: str, timeout_seconds: float = 2.0) -> None:
        self.domain = domain.strip()
        self.audience = audience.strip()
        self.timeout_seconds = timeout_seconds
        self._jwks_cache: Dict[str, Any] = {"keys": None, "expires_at": 0.0}

    @property
    def enabled(self) -> bool:
        return bool(self.domain and self.audience)

    @property
    def issuer(self) -> str:
        return f"https://{self.domain}/"

    @property
    def jwks_url(self) -> str:
        return f"{self.issuer}.well-known/jwks.json"

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

    def _get_jwks(self) -> Dict[str, Any]:
        if (
            isinstance(self._jwks_cache.get("keys"), list)
            and float(self._jwks_cache.get("expires_at") or 0.0) > time()
        ):
            return {"keys": self._jwks_cache["keys"]}

        try:
            response = httpx.get(self.jwks_url, timeout=self.timeout_seconds)
            response.raise_for_status()
        except httpx.HTTPError as exc:  # pragma: no cover - network dependent
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Auth provider unavailable: {exc}",
            ) from exc

        payload = response.json()
        keys = payload.get("keys") or []
        self._jwks_cache = {"keys": keys, "expires_at": time() + 600}
        return {"keys": keys}

    def verify(self, token: str) -> Dict[str, Any]:
        if not self.enabled:
            raise self._configuration_error()

        try:
            header = jwt.get_unverified_header(token)
        except JWTError as exc:
            raise self._credentials_error("Invalid token header.") from exc

        jwks = self._get_jwks()
        rsa_key: Optional[Dict[str, Any]] = None
        for key in jwks["keys"]:
            if key.get("kid") == header.get("kid"):
                rsa_key = {
                    "kty": key.get("kty"),
                    "kid": key.get("kid"),
                    "use": key.get("use"),
                    "n": key.get("n"),
                    "e": key.get("e"),
                }
                break

        if rsa_key is None:
            raise self._credentials_error("Signing key not found.")

        try:
            return jwt.decode(
                token,
                rsa_key,
                algorithms=["RS256"],
                audience=self.audience,
                issuer=self.issuer,
            )
        except JWTError as exc:
            raise self._credentials_error("Invalid or expired token.") from exc


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
