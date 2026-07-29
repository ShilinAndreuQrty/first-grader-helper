"""support public event lifecycle and recurring-series pauses

Revision ID: 20260729_0010
Revises: 20260729_0009
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260729_0010"
down_revision: str | None = "20260729_0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "events",
        sa.Column(
            "occurrence_status",
            sa.String(24),
            nullable=False,
            server_default="scheduled",
        ),
    )
    op.create_table(
        "event_series_blackouts",
        sa.Column("id", sa.String(36), nullable=False),
        sa.Column("series_id", sa.String(36), nullable=False),
        sa.Column("starts_on", sa.Date(), nullable=False),
        sa.Column("ends_on", sa.Date(), nullable=False),
        sa.Column("reason", sa.String(300), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "ends_on >= starts_on",
            name="ck_event_series_blackout_dates",
        ),
        sa.ForeignKeyConstraint(
            ["series_id"],
            ["event_series.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_event_series_blackouts_series_id",
        "event_series_blackouts",
        ["series_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_event_series_blackouts_series_id",
        table_name="event_series_blackouts",
    )
    op.drop_table("event_series_blackouts")
    op.drop_column("events", "occurrence_status")
