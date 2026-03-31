from functools import lru_cache
from pathlib import Path
from typing import Generator, Optional

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings

_runtime_database_url: Optional[str] = None


def _engine_options(database_url: str) -> dict:
    options = {"future": True}
    if database_url.startswith("sqlite"):
        options["connect_args"] = {"check_same_thread": False}
    else:
        # Keep pooled Postgres connections healthy on hosted platforms like Supabase.
        options["pool_pre_ping"] = True
        options["pool_recycle"] = 300
    return options


def _fallback_sqlite_url() -> str:
    return f"sqlite+pysqlite:///{Path('/tmp/investieren.db').as_posix()}"


def get_database_url() -> str:
    if _runtime_database_url:
        return _runtime_database_url
    return get_settings().database_url


def set_runtime_database_url(database_url: str) -> None:
    global _runtime_database_url
    _runtime_database_url = database_url
    reset_database_state()


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
