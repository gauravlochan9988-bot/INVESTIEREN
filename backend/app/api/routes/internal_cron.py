from contextlib import contextmanager
from dataclasses import asdict
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.deps import get_favorite_signal_monitor_service, get_user_alert_service
from app.core.config import get_settings
from app.core.database import get_db
from app.schemas.analysis import Strategy
from app.services.favorite_signal_monitor import FavoriteSignalMonitorService
from app.services.user_alerts import UserAlertService

router = APIRouter(tags=["internal"])


class FavoriteSignalCronResponse(BaseModel):
    user_keys_scanned: int
    symbols_checked: int
    events_created: int
    baseline_seeded: int
    skipped_no_data: int


class UserAlertCronResponse(BaseModel):
    rules_scanned: int
    notifications_created: int
    baseline_seeded: int
    skipped_no_data: int


@contextmanager
def cron_lock(db: Session, lock_key: int):
    """Postgres advisory lock to prevent overlapping cron runs."""
    if db.bind is None or db.bind.dialect.name != "postgresql":
        yield True
        return
    acquired = bool(
        db.execute(text("SELECT pg_try_advisory_lock(:key)"), {"key": int(lock_key)}).scalar()
    )
    if not acquired:
        yield False
        return
    try:
        yield True
    finally:
        db.execute(text("SELECT pg_advisory_unlock(:key)"), {"key": int(lock_key)})


def require_cron_secret(
    x_cron_secret: Optional[str] = Header(default=None, alias="X-Cron-Secret"),
) -> None:
    settings = get_settings()
    expected = (settings.cron_secret or "").strip()
    if not expected:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Cron is not configured (missing CRON_SECRET).",
        )
    provided = (x_cron_secret or "").strip()
    if provided != expected:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid cron secret.",
        )


@router.post(
    "/internal/cron/favorite-signals",
    response_model=FavoriteSignalCronResponse,
    dependencies=[Depends(require_cron_secret)],
)
def run_favorite_signal_cron(
    db: Session = Depends(get_db),
    monitor: FavoriteSignalMonitorService = Depends(get_favorite_signal_monitor_service),
    strategy: Strategy = Query(default="hedgefund"),
    force_refresh: bool = Query(default=True),
) -> FavoriteSignalCronResponse:
    with cron_lock(db, 733001) as acquired:
        if not acquired:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="favorite-signals cron already running.",
            )
        summary = monitor.run_scan(db, strategy=strategy, force_refresh=force_refresh)
        return FavoriteSignalCronResponse(**asdict(summary))


@router.post(
    "/internal/cron/user-alerts",
    response_model=UserAlertCronResponse,
    dependencies=[Depends(require_cron_secret)],
)
def run_user_alert_cron(
    db: Session = Depends(get_db),
    user_alert_service: UserAlertService = Depends(get_user_alert_service),
    force_refresh: bool = Query(default=True),
) -> UserAlertCronResponse:
    with cron_lock(db, 733002) as acquired:
        if not acquired:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="user-alerts cron already running.",
            )
        summary = user_alert_service.run_scan(db, force_refresh=force_refresh)
        return UserAlertCronResponse(**asdict(summary))
