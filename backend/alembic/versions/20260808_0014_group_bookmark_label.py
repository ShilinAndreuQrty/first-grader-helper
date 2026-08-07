"""add personal labels to saved groups

Revision ID: 20260808_0014
Revises: 20260729_0013
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260808_0014"
down_revision: str | None = "20260729_0013"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "user_group_bookmarks",
        sa.Column("label", sa.String(60), nullable=False, server_default=""),
    )


def downgrade() -> None:
    op.drop_column("user_group_bookmarks", "label")
