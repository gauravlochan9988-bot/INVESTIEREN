from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class AppSubscription(Base):
    __tablename__ = "app_subscriptions"
    __table_args__ = (
        UniqueConstraint("app_user_id", name="uq_app_subscription_user"),
        UniqueConstraint("stripe_subscription_id", name="uq_app_subscription_stripe_subscription"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    app_user_id: Mapped[int] = mapped_column(ForeignKey("app_users.id"), nullable=False, index=True)
    auth_subject: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    stripe_customer_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    stripe_subscription_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    stripe_checkout_session_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    status: Mapped[str] = mapped_column(String(64), nullable=False, default="inactive", index=True)
    plan_name: Mapped[str] = mapped_column(String(128), nullable=False, default="Investieren Pro Monthly")
    amount_cents: Mapped[int] = mapped_column(Integer, nullable=False, default=499)
    currency: Mapped[str] = mapped_column(String(8), nullable=False, default="eur")
    interval: Mapped[str] = mapped_column(String(16), nullable=False, default="month")
    cancel_at_period_end: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    current_period_end: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
