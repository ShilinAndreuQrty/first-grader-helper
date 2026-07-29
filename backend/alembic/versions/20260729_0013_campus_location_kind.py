"""classify campus locations

Revision ID: 20260729_0013
Revises: 20260729_0012
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260729_0013"
down_revision: str | None = "20260729_0012"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "campus_buildings",
        sa.Column(
            "kind",
            sa.String(24),
            nullable=False,
            server_default="academic",
        ),
    )
    op.create_index(
        "ix_campus_buildings_kind",
        "campus_buildings",
        ["kind"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_campus_buildings_kind", table_name="campus_buildings")
    op.drop_column("campus_buildings", "kind")
