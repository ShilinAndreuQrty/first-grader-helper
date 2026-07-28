"""add onboarding progress and issue reports

Revision ID: 20260729_0008
Revises: 20260729_0007
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260729_0008"
down_revision: str | None = "20260729_0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "user_onboarding_progress",
        sa.Column(
            "user_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "step_id",
            sa.String(36),
            sa.ForeignKey("onboarding_steps.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "issue_reports",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "user_id",
            sa.String(36),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
        ),
        sa.Column("context", sa.String(100), nullable=False),
        sa.Column("message", sa.String(2000), nullable=False),
        sa.Column("status", sa.String(24), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_issue_reports_user_id", "issue_reports", ["user_id"])
    op.create_index("ix_issue_reports_context", "issue_reports", ["context"])
    op.create_index("ix_issue_reports_status", "issue_reports", ["status"])


def downgrade() -> None:
    op.drop_table("issue_reports")
    op.drop_table("user_onboarding_progress")
