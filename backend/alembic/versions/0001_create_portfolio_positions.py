"""Create portfolio positions table."""

from alembic import op
import sqlalchemy as sa


revision = "0001_create_portfolio_positions"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "portfolio_positions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("symbol", sa.String(length=12), nullable=False),
        sa.Column("quantity", sa.Float(), nullable=False),
        sa.Column("average_price", sa.Float(), nullable=False),
        sa.Column("opened_at", sa.Date(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_portfolio_positions_id", "portfolio_positions", ["id"], unique=False)
    op.create_index("ix_portfolio_positions_symbol", "portfolio_positions", ["symbol"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_portfolio_positions_symbol", table_name="portfolio_positions")
    op.drop_index("ix_portfolio_positions_id", table_name="portfolio_positions")
    op.drop_table("portfolio_positions")
