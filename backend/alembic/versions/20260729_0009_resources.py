"""add contextual metadata to resource links

Revision ID: 20260729_0009
Revises: 20260729_0008
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260729_0009"
down_revision: str | None = "20260729_0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "resource_links",
        sa.Column("slug", sa.String(100), nullable=False, server_default=""),
    )
    op.add_column(
        "resource_links",
        sa.Column(
            "source_kind",
            sa.String(24),
            nullable=False,
            server_default="student",
        ),
    )
    op.add_column(
        "resource_links",
        sa.Column(
            "contexts",
            sa.String(300),
            nullable=False,
            server_default="catalog",
        ),
    )
    op.create_index("ix_resource_links_slug", "resource_links", ["slug"])


def downgrade() -> None:
    op.drop_index("ix_resource_links_slug", table_name="resource_links")
    op.drop_column("resource_links", "contexts")
    op.drop_column("resource_links", "source_kind")
    op.drop_column("resource_links", "slug")
