"""add campus announcements and onboarding content

Revision ID: 20260729_0005
Revises: 20260729_0004
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260729_0005"
down_revision: str | None = "20260729_0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def timestamps() -> list[sa.Column]:
    return [
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    ]


def upgrade() -> None:
    op.create_table(
        "campus_buildings",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("short_name", sa.String(80), nullable=False, unique=True),
        sa.Column("address", sa.String(300), nullable=False),
        sa.Column("entrance_hint", sa.String(500), nullable=False),
        sa.Column("dgis_url", sa.String(1000), nullable=False),
        sa.Column("latitude", sa.String(32)),
        sa.Column("longitude", sa.String(32)),
        sa.Column("status", sa.String(24), nullable=False),
        sa.Column("verified_at", sa.DateTime(timezone=True)),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
        *timestamps(),
    )
    op.create_index("ix_campus_buildings_status", "campus_buildings", ["status"])
    op.create_table(
        "campus_rooms",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "building_id",
            sa.String(36),
            sa.ForeignKey("campus_buildings.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("room_number", sa.String(40), nullable=False),
        sa.Column("title", sa.String(160), nullable=False),
        sa.Column("floor", sa.String(20), nullable=False),
        sa.Column("directions", sa.String(500), nullable=False),
        sa.Column("status", sa.String(24), nullable=False),
        sa.Column("verified_at", sa.DateTime(timezone=True)),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
        *timestamps(),
    )
    op.create_index("ix_campus_rooms_building_id", "campus_rooms", ["building_id"])
    op.create_index("ix_campus_rooms_status", "campus_rooms", ["status"])
    op.create_index(
        "uq_campus_room_building_number",
        "campus_rooms",
        ["building_id", "room_number"],
        unique=True,
    )
    op.create_table(
        "announcements",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("status", sa.String(24), nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True)),
        sa.Column("ends_at", sa.DateTime(timezone=True)),
        sa.Column("importance", sa.String(20), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
        *timestamps(),
    )
    op.create_index("ix_announcements_status", "announcements", ["status"])
    op.create_table(
        "onboarding_steps",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("slug", sa.String(100), nullable=False, unique=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.String(500), nullable=False),
        sa.Column("action_path", sa.String(300), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(24), nullable=False),
        sa.Column("valid_from", sa.DateTime(timezone=True)),
        sa.Column("valid_until", sa.DateTime(timezone=True)),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
        *timestamps(),
    )
    op.create_index("ix_onboarding_steps_status", "onboarding_steps", ["status"])


def downgrade() -> None:
    op.drop_table("onboarding_steps")
    op.drop_table("announcements")
    op.drop_table("campus_rooms")
    op.drop_table("campus_buildings")
