"""bind authenticated sessions to a frontend application variant

Revision ID: 20260828_0015
Revises: 20260808_0014
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260828_0015"
down_revision: str | None = "20260808_0014"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "user_sessions",
        sa.Column(
            "app_variant",
            sa.String(16),
            nullable=False,
            server_default="public",
        ),
    )
    op.create_index(
        "ix_user_sessions_app_variant",
        "user_sessions",
        ["app_variant"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_user_sessions_app_variant", table_name="user_sessions")
    op.drop_column("user_sessions", "app_variant")
