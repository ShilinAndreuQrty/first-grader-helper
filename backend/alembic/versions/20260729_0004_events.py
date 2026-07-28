"""add events recurring series overrides and subscriptions

Revision ID: 20260729_0004
Revises: 20260729_0003
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260729_0004"
down_revision: str | None = "20260729_0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def timestamps() -> list[sa.Column]:
    return [
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    ]


def upgrade() -> None:
    op.create_table(
        "event_series",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("event_type", sa.String(60), nullable=False),
        sa.Column("recurrence_weekday", sa.Integer(), nullable=False),
        sa.Column("local_start_time", sa.Time(), nullable=False),
        sa.Column("duration_minutes", sa.Integer(), nullable=False),
        sa.Column("timezone", sa.String(64), nullable=False),
        sa.Column("starts_on", sa.Date(), nullable=False),
        sa.Column("ends_on", sa.Date(), nullable=False),
        sa.Column("location", sa.String(300), nullable=False),
        sa.Column("organizer", sa.String(200), nullable=False),
        sa.Column("external_url", sa.String(1000)),
        sa.Column("status", sa.String(24), nullable=False),
        sa.Column("is_confirmed", sa.Boolean(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
        *timestamps(),
    )
    op.create_index("ix_event_series_event_type", "event_series", ["event_type"])
    op.create_index("ix_event_series_status", "event_series", ["status"])
    op.create_table(
        "events",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("event_type", sa.String(60), nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("all_day", sa.Boolean(), nullable=False),
        sa.Column("location", sa.String(300), nullable=False),
        sa.Column("organizer", sa.String(200), nullable=False),
        sa.Column("external_url", sa.String(1000)),
        sa.Column("status", sa.String(24), nullable=False),
        sa.Column("is_confirmed", sa.Boolean(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
        sa.Column("version", sa.Integer(), nullable=False),
        *timestamps(),
    )
    op.create_index("ix_events_event_type", "events", ["event_type"])
    op.create_index("ix_events_starts_at", "events", ["starts_at"])
    op.create_index("ix_events_status", "events", ["status"])
    op.create_table(
        "event_occurrence_overrides",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "series_id",
            sa.String(36),
            sa.ForeignKey("event_series.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("original_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("replacement_start", sa.DateTime(timezone=True)),
        sa.Column("replacement_end", sa.DateTime(timezone=True)),
        sa.Column("status", sa.String(24), nullable=False),
        sa.Column("location", sa.String(300)),
        sa.Column("is_confirmed", sa.Boolean(), nullable=False),
        *timestamps(),
    )
    op.create_index(
        "uq_event_override_series_start",
        "event_occurrence_overrides",
        ["series_id", "original_start"],
        unique=True,
    )
    op.create_index(
        "ix_event_occurrence_overrides_series_id",
        "event_occurrence_overrides",
        ["series_id"],
    )
    op.create_table(
        "event_subscriptions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "user_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "event_id",
            sa.String(36),
            sa.ForeignKey("events.id", ondelete="CASCADE"),
        ),
        sa.Column(
            "series_id",
            sa.String(36),
            sa.ForeignKey("event_series.id", ondelete="CASCADE"),
        ),
        sa.Column("occurrence_start", sa.DateTime(timezone=True)),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_event_subscriptions_user_id", "event_subscriptions", ["user_id"])


def downgrade() -> None:
    op.drop_table("event_subscriptions")
    op.drop_table("event_occurrence_overrides")
    op.drop_table("events")
    op.drop_table("event_series")
