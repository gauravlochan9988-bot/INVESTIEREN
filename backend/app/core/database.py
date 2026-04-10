from copy import deepcopy
from functools import lru_cache
from pathlib import Path
from typing import Any, Generator, Optional
from urllib.parse import urlparse

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings

_runtime_database_url: Optional[str] = None
_database_status: dict[str, Any] = {
    "backend": "unknown",
    "mode": "primary",
    "fallback_active": False,
    "healthy": False,
    "reason": None,
}


def _engine_options(database_url: str) -> dict:
    options = {"future": True}
    if database_url.startswith("sqlite"):
        options["connect_args"] = {"check_same_thread": False}
    else:
        # Keep pooled Postgres connections healthy on hosted Postgres platforms like Neon.
        options["pool_pre_ping"] = True
        options["pool_recycle"] = 300
    return options


def _fallback_sqlite_url() -> str:
    return f"sqlite+pysqlite:///{Path('/tmp/investieren.db').as_posix()}"


def _database_backend_label(database_url: str) -> str:
    if database_url.startswith("sqlite"):
        return "sqlite"

    parsed = urlparse(database_url)
    hostname = (parsed.hostname or "").lower()
    if "neon.tech" in hostname:
        return "neon"
    if parsed.scheme.startswith("postgresql"):
        return "postgres"
    return parsed.scheme or "unknown"


def get_database_url() -> str:
    if _runtime_database_url:
        return _runtime_database_url
    return get_settings().database_url


def set_runtime_database_url(database_url: str) -> None:
    global _runtime_database_url
    _runtime_database_url = database_url
    reset_database_state()


def mark_database_status(
    database_url: str,
    *,
    healthy: bool,
    mode: str = "primary",
    reason: Optional[str] = None,
) -> None:
    global _database_status
    _database_status = {
        "backend": _database_backend_label(database_url),
        "mode": mode,
        "fallback_active": mode == "fallback",
        "healthy": healthy,
        "reason": reason,
    }


def get_database_status() -> dict[str, Any]:
    if _database_status["backend"] == "unknown":
        mark_database_status(get_database_url(), healthy=False)
    return deepcopy(_database_status)


@lru_cache
def get_engine() -> Engine:
    database_url = get_database_url()
    return create_engine(database_url, **_engine_options(database_url))


@lru_cache
def get_session_factory() -> sessionmaker:
    return sessionmaker(
        bind=get_engine(),
        autoflush=False,
        autocommit=False,
        expire_on_commit=False,
    )


def get_db() -> Generator[Session, None, None]:
    session = get_session_factory()()
    try:
        yield session
    finally:
        session.close()


def reset_database_state() -> None:
    get_session_factory.cache_clear()
    get_engine.cache_clear()
