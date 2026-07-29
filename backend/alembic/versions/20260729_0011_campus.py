"""add verified campus catalogue metadata

Revision ID: 20260729_0011
Revises: 20260729_0010
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260729_0011"
down_revision: str | None = "20260729_0010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    columns = (
        sa.Column("slug", sa.String(80), nullable=False, server_default=""),
        sa.Column("building_number", sa.String(20), nullable=False, server_default=""),
        sa.Column("aliases", sa.String(500), nullable=False, server_default="[]"),
        sa.Column("complex_slug", sa.String(80), nullable=False, server_default=""),
        sa.Column("dgis_object_id", sa.String(80), nullable=False, server_default=""),
        sa.Column("dgis_complex_id", sa.String(80)),
        sa.Column("source_url", sa.String(1000), nullable=False, server_default=""),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
    )
    for column in columns:
        op.add_column("campus_buildings", column)
    # Older deployments may contain editor-created rows; give each a stable
    # non-colliding fallback before enforcing uniqueness.
    op.execute(
        "UPDATE campus_buildings SET slug = 'legacy-' || id WHERE slug = ''"
    )
    op.create_index(
        "ix_campus_buildings_slug",
        "campus_buildings",
        ["slug"],
        unique=True,
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_campus_buildings_slug")
    op.execute("DROP INDEX IF EXISTS uq_campus_buildings_slug")
    for name in (
        "sort_order",
        "source_url",
        "dgis_complex_id",
        "dgis_object_id",
        "complex_slug",
        "aliases",
        "building_number",
        "slug",
    ):
        op.drop_column("campus_buildings", name)
