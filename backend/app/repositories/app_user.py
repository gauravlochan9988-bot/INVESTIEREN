from __future__ import annotations

from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.app_user import AppUser


class AppUserRepository:
    def get_by_subject(self, db: Session, *, auth_subject: str) -> Optional[AppUser]:
        statement = select(AppUser).where(AppUser.auth_subject == auth_subject)
        return db.scalar(statement)

    def get_by_email(self, db: Session, *, email: str) -> Optional[AppUser]:
        normalized_email = (email or "").strip().lower()
        if not normalized_email:
            return None
        statement = select(AppUser).where(func.lower(AppUser.email) == normalized_email)
        return db.scalar(statement)

    def upsert_from_claims(
        self,
        db: Session,
        *,
        auth_subject: str,
        provider: Optional[str] = None,
        email: Optional[str],
        name: Optional[str],
        picture_url: Optional[str],
        preserve_existing_name: bool = True,
    ) -> AppUser:
        row = self.get_by_subject(db, auth_subject=auth_subject)
        normalized_email = (email or "").strip().lower() or None
        if row is None and normalized_email:
            row = db.scalar(
                select(AppUser).where(func.lower(AppUser.email) == normalized_email)
            )
        resolved_provider = provider or (auth_subject.split("|", 1)[0] if "|" in auth_subject else "clerk")
        if row is None:
            row = AppUser(
                auth_subject=auth_subject,
                provider=resolved_provider,
                email=normalized_email,
                name=name,
                picture_url=picture_url,
            )
            db.add(row)
        else:
            row.auth_subject = auth_subject
            row.provider = resolved_provider
            row.email = normalized_email
            if not preserve_existing_name or not (row.name or "").strip():
                row.name = name
            row.picture_url = picture_url

        db.commit()
        db.refresh(row)
        return row

    def update_name(self, db: Session, *, auth_subject: str, name: str) -> Optional[AppUser]:
        row = self.get_by_subject(db, auth_subject=auth_subject)
        if row is None:
            return None
        row.name = (name or "").strip()
        db.commit()
        db.refresh(row)
        return row
