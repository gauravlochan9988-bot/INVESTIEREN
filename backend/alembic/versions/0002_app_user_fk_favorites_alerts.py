"""Link favorites and alert rows to app_users."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0002_app_user_fk_favorites_alerts"
down_revision = "0001_create_portfolio_positions"
branch_labels = None
depends_on = None


def _add_column_and_fk(table: str) -> None:
    bind = op.get_bind()
    fk_name = f"fk_{table}_app_user_id_app_users"
    if bind.dialect.name == "sqlite":
        with op.batch_alter_table(table) as batch:
            batch.add_column(sa.Column("app_user_id", sa.Integer(), nullable=True))
            batch.create_foreign_key(fk_name, "app_users", ["app_user_id"], ["id"], ondelete="SET NULL")
    else:
        op.add_column(table, sa.Column("app_user_id", sa.Integer(), nullable=True))
        op.create_foreign_key(fk_name, table, "app_users", ["app_user_id"], ["id"], ondelete="SET NULL")
    op.create_index(f"ix_{table}_app_user_id", table, ["app_user_id"], unique=False)


def _backfill(table: str) -> None:
    op.execute(
        sa.text(
            f"""
            UPDATE {table}
            SET app_user_id = (
                SELECT app_users.id FROM app_users
                WHERE app_users.auth_subject = {table}.user_key
            )
            WHERE EXISTS (
                SELECT 1 FROM app_users
                WHERE app_users.auth_subject = {table}.user_key
            )
            """
        )
    )


def upgrade() -> None:
    for tbl in ("favorite_symbols", "alert_events", "alert_states"):
        _add_column_and_fk(tbl)
        _backfill(tbl)


def _drop_fk_and_column(table: str) -> None:
    bind = op.get_bind()
    fk_name = f"fk_{table}_app_user_id_app_users"
    op.drop_index(f"ix_{table}_app_user_id", table_name=table)
    if bind.dialect.name == "sqlite":
        with op.batch_alter_table(table) as batch:
            batch.drop_constraint(fk_name, type_="foreignkey")
            batch.drop_column("app_user_id")
    else:
        op.drop_constraint(fk_name, table, type_="foreignkey")
        op.drop_column(table, "app_user_id")


def downgrade() -> None:
    for tbl in ("alert_states", "alert_events", "favorite_symbols"):
        _drop_fk_and_column(tbl)
