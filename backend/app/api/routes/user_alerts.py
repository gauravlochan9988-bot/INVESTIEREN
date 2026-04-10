from __future__ import annotations

from dataclasses import asdict

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import (
    RequestUserContext,
    get_user_alert_service,
    require_authenticated_user_context,
)
from app.core.database import get_db
from app.schemas.user_alerts import (
    AlertRuleCreate,
    AlertRuleResponse,
    AlertRuleUpdate,
    MarkAllNotificationsReadResponse,
    NotificationResponse,
)
from app.services.user_alerts import UserAlertService

router = APIRouter(tags=["user-alerts"])


@router.get("/alert-rules", response_model=list[AlertRuleResponse])
def list_alert_rules(
    db: Session = Depends(get_db),
    user_context: RequestUserContext = Depends(require_authenticated_user_context),
    user_alert_service: UserAlertService = Depends(get_user_alert_service),
) -> list[AlertRuleResponse]:
    return user_alert_service.list_rules(db, user_id=user_context.app_user_id)


@router.post("/alert-rules", response_model=AlertRuleResponse)
def create_alert_rule(
    payload: AlertRuleCreate,
    db: Session = Depends(get_db),
    user_context: RequestUserContext = Depends(require_authenticated_user_context),
    user_alert_service: UserAlertService = Depends(get_user_alert_service),
) -> AlertRuleResponse:
    return user_alert_service.create_rule(db, user_id=user_context.app_user_id, payload=payload)


@router.patch("/alert-rules/{rule_id}", response_model=AlertRuleResponse)
def update_alert_rule(
    rule_id: int,
    payload: AlertRuleUpdate,
    db: Session = Depends(get_db),
    user_context: RequestUserContext = Depends(require_authenticated_user_context),
    user_alert_service: UserAlertService = Depends(get_user_alert_service),
) -> AlertRuleResponse:
    row = user_alert_service.update_rule(db, user_id=user_context.app_user_id, rule_id=rule_id, payload=payload)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert rule not found.")
    return row


@router.delete("/alert-rules/{rule_id}", response_model=AlertRuleResponse)
def delete_alert_rule(
    rule_id: int,
    db: Session = Depends(get_db),
    user_context: RequestUserContext = Depends(require_authenticated_user_context),
    user_alert_service: UserAlertService = Depends(get_user_alert_service),
) -> AlertRuleResponse:
    row = user_alert_service.delete_rule(db, user_id=user_context.app_user_id, rule_id=rule_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert rule not found.")
    return row


@router.get("/notifications", response_model=list[NotificationResponse])
def list_notifications(
    limit: int = Query(default=20, ge=1, le=100),
    unread_only: bool = Query(default=False),
    db: Session = Depends(get_db),
    user_context: RequestUserContext = Depends(require_authenticated_user_context),
    user_alert_service: UserAlertService = Depends(get_user_alert_service),
) -> list[NotificationResponse]:
    return user_alert_service.list_notifications(
        db,
        user_id=user_context.app_user_id,
        limit=limit,
        unread_only=unread_only,
    )


@router.patch("/notifications/{notification_id}/read", response_model=NotificationResponse)
def mark_notification_read(
    notification_id: int,
    db: Session = Depends(get_db),
    user_context: RequestUserContext = Depends(require_authenticated_user_context),
    user_alert_service: UserAlertService = Depends(get_user_alert_service),
) -> NotificationResponse:
    row = user_alert_service.mark_notification_read(
        db,
        user_id=user_context.app_user_id,
        notification_id=notification_id,
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found.")
    return row


@router.post("/notifications/read-all", response_model=MarkAllNotificationsReadResponse)
def mark_all_notifications_read(
    db: Session = Depends(get_db),
    user_context: RequestUserContext = Depends(require_authenticated_user_context),
    user_alert_service: UserAlertService = Depends(get_user_alert_service),
) -> MarkAllNotificationsReadResponse:
    updated = user_alert_service.mark_all_notifications_read(db, user_id=user_context.app_user_id)
    return MarkAllNotificationsReadResponse(updated=updated)
