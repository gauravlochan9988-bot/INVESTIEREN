from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.api.deps import (
    RequestUserContext,
    get_app_user_repository,
    get_billing_service,
    get_request_user_context,
)
from app.core.database import get_db
from app.repositories.app_user import AppUserRepository
from app.schemas.billing import BillingSyncResponse, CheckoutSessionResponse, SubscriptionStatusResponse
from app.services.billing import BillingService


router = APIRouter(prefix="/billing", tags=["billing"])


def _require_authenticated_user(
    db: Session,
    user_context: RequestUserContext,
    app_user_repository: AppUserRepository,
):
    if not user_context.is_authenticated or not user_context.app_user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required.",
        )
    user = app_user_repository.get_by_subject(db, auth_subject=user_context.user_key)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )
    return user


@router.post("/checkout", response_model=CheckoutSessionResponse)
def create_checkout(
    db: Session = Depends(get_db),
    user_context: RequestUserContext = Depends(get_request_user_context),
    app_user_repository: AppUserRepository = Depends(get_app_user_repository),
    billing_service: BillingService = Depends(get_billing_service),
) -> CheckoutSessionResponse:
    user = _require_authenticated_user(db, user_context, app_user_repository)
    session = billing_service.create_checkout_session(db, app_user=user)
    return CheckoutSessionResponse(**session)


@router.get("/subscription", response_model=SubscriptionStatusResponse)
def get_subscription_status(
    db: Session = Depends(get_db),
    user_context: RequestUserContext = Depends(get_request_user_context),
    app_user_repository: AppUserRepository = Depends(get_app_user_repository),
    billing_service: BillingService = Depends(get_billing_service),
) -> SubscriptionStatusResponse:
    user = _require_authenticated_user(db, user_context, app_user_repository)
    payload = billing_service.get_subscription_status(db, app_user_id=user.id)
    return SubscriptionStatusResponse(**payload)


@router.get("/checkout-session/{session_id}", response_model=BillingSyncResponse)
def sync_checkout_session(
    session_id: str,
    db: Session = Depends(get_db),
    user_context: RequestUserContext = Depends(get_request_user_context),
    app_user_repository: AppUserRepository = Depends(get_app_user_repository),
    billing_service: BillingService = Depends(get_billing_service),
) -> BillingSyncResponse:
    user = _require_authenticated_user(db, user_context, app_user_repository)
    payload = billing_service.sync_checkout_session(db, app_user=user, session_id=session_id)
    return BillingSyncResponse(**payload)


@router.post("/webhook")
async def stripe_webhook(
    request: Request,
    stripe_signature: Optional[str] = Header(default=None, alias="Stripe-Signature"),
    db: Session = Depends(get_db),
    billing_service: BillingService = Depends(get_billing_service),
) -> dict:
    payload = await request.body()
    return billing_service.handle_webhook(db, payload=payload, signature=stripe_signature)
