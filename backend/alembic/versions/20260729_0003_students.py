"""add groups tutors bookmarks and resource directory

Revision ID: 20260729_0003
Revises: 20260729_0002
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260729_0003"
down_revision: str | None = "20260729_0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "student_groups",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("code", sa.String(80), nullable=False),
        sa.Column("normalized_code", sa.String(80), nullable=False),
        sa.Column("academic_year", sa.String(16), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("valid_from", sa.DateTime(timezone=True)),
        sa.Column("valid_until", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("normalized_code", name="uq_student_groups_normalized_code"),
    )
    op.create_index("ix_student_groups_normalized_code", "student_groups", ["normalized_code"])
    op.create_index("ix_student_groups_is_active", "student_groups", ["is_active"])
    op.create_table(
        "tutors",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("full_name", sa.String(160), nullable=False),
        sa.Column("vk_user_id", sa.BigInteger()),
        sa.Column("vk_url", sa.String(500), nullable=False),
        sa.Column("description", sa.String(500), nullable=False),
        sa.Column("photo_url", sa.String(1000)),
        sa.Column("status", sa.String(24), nullable=False),
        sa.Column("valid_from", sa.DateTime(timezone=True)),
        sa.Column("valid_until", sa.DateTime(timezone=True)),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("vk_user_id", name="uq_tutors_vk_user_id"),
    )
    op.create_index("ix_tutors_status", "tutors", ["status"])
    op.create_table(
        "group_tutors",
        sa.Column(
            "group_id",
            sa.String(36),
            sa.ForeignKey("student_groups.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "tutor_id",
            sa.String(36),
            sa.ForeignKey("tutors.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "user_group_bookmarks",
        sa.Column(
            "user_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "group_id",
            sa.String(36),
            sa.ForeignKey("student_groups.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("is_primary", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_user_group_bookmarks_is_primary",
        "user_group_bookmarks",
        ["is_primary"],
    )
    op.create_table(
        "resource_categories",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("slug", sa.String(80), nullable=False),
        sa.Column("title", sa.String(120), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("slug", name="uq_resource_categories_slug"),
    )
    op.create_table(
        "resource_links",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "category_id",
            sa.String(36),
            sa.ForeignKey("resource_categories.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("url", sa.String(1000), nullable=False),
        sa.Column("description", sa.String(500), nullable=False),
        sa.Column("icon", sa.String(80), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_resource_links_category_id", "resource_links", ["category_id"])
    op.create_index("ix_resource_links_is_active", "resource_links", ["is_active"])


def downgrade() -> None:
    op.drop_table("resource_links")
    op.drop_table("resource_categories")
    op.drop_table("user_group_bookmarks")
    op.drop_table("group_tutors")
    op.drop_table("tutors")
    op.drop_table("student_groups")
