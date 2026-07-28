"""add notification preferences jobs and deliveries

Revision ID: 20260729_0007
Revises: 20260729_0006
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260729_0007"
down_revision: str | None = "20260729_0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "notification_preferences",
        sa.Column(
            "user_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("union_meetings", sa.Boolean(), nullable=False),
        sa.Column("selected_events", sa.Boolean(), nullable=False),
        sa.Column("announcements", sa.Boolean(), nullable=False),
        sa.Column("minutes_before", sa.Integer(), nullable=False),
        sa.Column("in_app_enabled", sa.Boolean(), nullable=False),
        sa.Column("vk_notifications_enabled", sa.Boolean(), nullable=False),
        sa.Column("community_messages_enabled", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "notification_jobs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("idempotency_key", sa.String(220), nullable=False, unique=True),
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
        sa.Column("scheduled_for", sa.DateTime(timezone=True), nullable=False),
        sa.Column("channel", sa.String(32), nullable=False),
        sa.Column("payload_json", sa.Text(), nullable=False),
        sa.Column("status", sa.String(24), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("locked_at", sa.DateTime(timezone=True)),
        sa.Column("last_error", sa.String(200), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_notification_jobs_idempotency_key",
        "notification_jobs",
        ["idempotency_key"],
        unique=True,
    )
    op.create_index("ix_notification_jobs_user_id", "notification_jobs", ["user_id"])
    op.create_index("ix_notification_jobs_scheduled_for", "notification_jobs", ["scheduled_for"])
    op.create_index("ix_notification_jobs_status", "notification_jobs", ["status"])
    op.create_table(
        "notification_deliveries",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "job_id",
            sa.String(36),
            sa.ForeignKey("notification_jobs.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("provider", sa.String(40), nullable=False),
        sa.Column("status", sa.String(24), nullable=False),
        sa.Column("provider_message_id", sa.String(160), nullable=False),
        sa.Column("error_code", sa.String(80), nullable=False),
        sa.Column("delivered_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_notification_deliveries_job_id",
        "notification_deliveries",
        ["job_id"],
        unique=True,
    )
    op.create_index("ix_notification_deliveries_status", "notification_deliveries", ["status"])


def downgrade() -> None:
    op.drop_table("notification_deliveries")
    op.drop_table("notification_jobs")
    op.drop_table("notification_preferences")
