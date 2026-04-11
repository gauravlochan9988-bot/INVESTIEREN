from __future__ import annotations

from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.app_user_preference import AppUserPreference


class AppUserPreferenceRepository:
    def get_by_user_id(self, db: Session, *, app_user_id: int) -> Optional[AppUserPreference]:
        return db.scalar(select(AppUserPreference).where(AppUserPreference.app_user_id == app_user_id))

    def upsert_for_user(
        self,
        db: Session,
        *,
        app_user_id: int,
        updates: dict[str, Any] | None = None,
    ) -> AppUserPreference:
        row = self.get_by_user_id(db, app_user_id=app_user_id)
        if row is None:
            row = AppUserPreference(app_user_id=app_user_id)
            db.add(row)

        for key, value in (updates or {}).items():
            if hasattr(row, key):
                setattr(row, key, value)

        db.commit()
        db.refresh(row)
        return row
