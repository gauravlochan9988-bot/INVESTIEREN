from __future__ import annotations

from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.app_user import AppUser


class AppUserRepository:
    def get_by_subject(self, db: Session, *, auth_subject: str) -> Optional[AppUser]:
        statement = select(AppUser).where(AppUser.auth_subject == auth_subject)
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
    ) -> AppUser:
        row = self.get_by_subject(db, auth_subject=auth_subject)
        resolved_provider = provider or (auth_subject.split("|", 1)[0] if "|" in auth_subject else "clerk")
        if row is None:
            row = AppUser(
                auth_subject=auth_subject,
                provider=resolved_provider,
                email=email,
                name=name,
                picture_url=picture_url,
            )
            db.add(row)
        else:
            row.provider = resolved_provider
            row.email = email
            row.name = name
            row.picture_url = picture_url

        db.commit()
        db.refresh(row)
        return row
