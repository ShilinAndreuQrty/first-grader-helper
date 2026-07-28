"""add external schedule cache

Revision ID: 20260729_0006
Revises: 20260729_0005
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260729_0006"
down_revision: str | None = "20260729_0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "external_schedule_cache",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("cache_key", sa.String(180), nullable=False, unique=True),
        sa.Column("payload_json", sa.Text(), nullable=False),
        sa.Column("fetched_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_external_schedule_cache_cache_key",
        "external_schedule_cache",
        ["cache_key"],
        unique=True,
    )
    op.create_index(
        "ix_external_schedule_cache_expires_at",
        "external_schedule_cache",
        ["expires_at"],
    )


def downgrade() -> None:
    op.drop_table("external_schedule_cache")
