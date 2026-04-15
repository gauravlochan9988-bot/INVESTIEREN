from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import (
    RequestUserContext,
    get_admin_access_service,
    require_owner_user_context,
)
from app.core.database import get_db
from app.schemas.admin_access import (
    AdminUserAccessLookupResponse,
    AdminUserAccessUpdateRequest,
    AdminUserAccessUpdateResponse,
)
from app.services.admin_access import AdminAccessService


router = APIRouter(prefix="/admin/access", tags=["admin"])


@router.get("/user", response_model=AdminUserAccessLookupResponse)
def lookup_user_access(
    email: str = Query(..., min_length=5),
    db: Session = Depends(get_db),
    _: RequestUserContext = Depends(require_owner_user_context),
    admin_access_service: AdminAccessService = Depends(get_admin_access_service),
) -> AdminUserAccessLookupResponse:
    return admin_access_service.lookup_user(db, email=email)


@router.post("/grant-pro", response_model=AdminUserAccessUpdateResponse)
def grant_user_pro(
    payload: AdminUserAccessUpdateRequest,
    db: Session = Depends(get_db),
    _: RequestUserContext = Depends(require_owner_user_context),
    admin_access_service: AdminAccessService = Depends(get_admin_access_service),
) -> AdminUserAccessUpdateResponse:
    try:
        user = admin_access_service.grant_pro(db, email=str(payload.email))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return AdminUserAccessUpdateResponse(
        status="ok",
        user=user,
        message="Pro access granted.",
    )


@router.post("/revoke-pro", response_model=AdminUserAccessUpdateResponse)
def revoke_user_pro(
    payload: AdminUserAccessUpdateRequest,
    db: Session = Depends(get_db),
    _: RequestUserContext = Depends(require_owner_user_context),
    admin_access_service: AdminAccessService = Depends(get_admin_access_service),
) -> AdminUserAccessUpdateResponse:
    try:
        user = admin_access_service.revoke_pro(db, email=str(payload.email))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return AdminUserAccessUpdateResponse(
        status="ok",
        user=user,
        message="Pro access removed.",
    )
