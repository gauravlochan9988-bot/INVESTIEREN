"""Add composite indexes for alerts, favorites and notifications hot paths."""

from __future__ import annotations

from alembic import op

revision = "0003_add_perf_indexes_alerts_cron"
down_revision = "0002_app_user_fk_favorites_alerts"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(
        "ix_alert_events_app_user_strategy_created_id",
        "alert_events",
        ["app_user_id", "strategy", "created_at", "id"],
        unique=False,
    )
    op.create_index(
        "ix_alert_events_user_key_strategy_created_id",
        "alert_events",
        ["user_key", "strategy", "created_at", "id"],
        unique=False,
    )
    op.create_index(
        "ix_alert_states_app_user_symbol_strategy",
        "alert_states",
        ["app_user_id", "symbol", "strategy"],
        unique=False,
    )
    op.create_index(
        "ix_alert_states_user_key_symbol_strategy",
        "alert_states",
        ["user_key", "symbol", "strategy"],
        unique=False,
    )
    op.create_index(
        "ix_favorite_symbols_app_user_symbol",
        "favorite_symbols",
        ["app_user_id", "symbol"],
        unique=False,
    )
    op.create_index(
        "ix_user_notifications_user_created_id",
        "user_notifications",
        ["user_id", "created_at", "id"],
        unique=False,
    )
    op.create_index(
        "ix_user_notifications_user_status_created_id",
        "user_notifications",
        ["user_id", "status", "created_at", "id"],
        unique=False,
    )
    op.create_index(
        "ix_alert_rules_user_strategy_symbol",
        "alert_rules",
        ["user_id", "strategy", "symbol"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_alert_rules_user_strategy_symbol", table_name="alert_rules")
    op.drop_index("ix_user_notifications_user_status_created_id", table_name="user_notifications")
    op.drop_index("ix_user_notifications_user_created_id", table_name="user_notifications")
    op.drop_index("ix_favorite_symbols_app_user_symbol", table_name="favorite_symbols")
    op.drop_index("ix_alert_states_user_key_symbol_strategy", table_name="alert_states")
    op.drop_index("ix_alert_states_app_user_symbol_strategy", table_name="alert_states")
    op.drop_index("ix_alert_events_user_key_strategy_created_id", table_name="alert_events")
    op.drop_index("ix_alert_events_app_user_strategy_created_id", table_name="alert_events")
