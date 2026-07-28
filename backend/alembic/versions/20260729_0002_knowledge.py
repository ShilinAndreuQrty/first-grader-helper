"""create verified FAQ and assistant analytics tables

Revision ID: 20260729_0002
Revises: 20260729_0001
Create Date: 2026-07-29
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260729_0002"
down_revision: str | None = "20260729_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    connection = op.get_bind()
    if connection.dialect.name == "postgresql":
        op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")

    op.create_table(
        "faq_categories",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("source_key", sa.String(length=160), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_faq_categories")),
        sa.UniqueConstraint("source_key", name=op.f("uq_faq_categories_source_key")),
    )
    op.create_table(
        "faq_entries",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("category_id", sa.String(length=36), nullable=False),
        sa.Column("question", sa.String(length=500), nullable=False),
        sa.Column("answer_markdown", sa.Text(), nullable=False),
        sa.Column("search_keywords_json", sa.Text(), nullable=False),
        sa.Column("source_key", sa.String(length=220), nullable=False),
        sa.Column("source_url", sa.String(length=1000), nullable=True),
        sa.Column("status", sa.String(length=24), nullable=False),
        sa.Column("is_time_sensitive", sa.Boolean(), nullable=False),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("valid_from", sa.DateTime(timezone=True), nullable=True),
        sa.Column("valid_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", sa.String(length=36), nullable=True),
        sa.Column("updated_by", sa.String(length=36), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["category_id"],
            ["faq_categories.id"],
            name=op.f("fk_faq_entries_category_id_faq_categories"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["created_by"],
            ["users.id"],
            name=op.f("fk_faq_entries_created_by_users"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["updated_by"],
            ["users.id"],
            name=op.f("fk_faq_entries_updated_by_users"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_faq_entries")),
        sa.UniqueConstraint("source_key", name=op.f("uq_faq_entries_source_key")),
    )
    op.create_index(
        op.f("ix_faq_entries_category_id"),
        "faq_entries",
        ["category_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_faq_entries_deleted_at"),
        "faq_entries",
        ["deleted_at"],
        unique=False,
    )
    op.create_index(
        "ix_faq_entries_public",
        "faq_entries",
        ["status", "valid_until", "deleted_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_faq_entries_source_key"),
        "faq_entries",
        ["source_key"],
        unique=True,
    )
    op.create_index(op.f("ix_faq_entries_status"), "faq_entries", ["status"], unique=False)
    op.create_index(
        op.f("ix_faq_entries_valid_until"),
        "faq_entries",
        ["valid_until"],
        unique=False,
    )
    if connection.dialect.name == "postgresql":
        op.execute(
            "CREATE INDEX ix_faq_entries_question_trgm "
            "ON faq_entries USING gin (question gin_trgm_ops)"
        )
        op.execute(
            "CREATE INDEX ix_faq_entries_search_tsv "
            "ON faq_entries USING gin "
            "(to_tsvector('russian', question || ' ' || answer_markdown || ' ' || "
            "search_keywords_json))"
        )

    op.create_table(
        "faq_entry_versions",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("faq_entry_id", sa.String(length=36), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("snapshot_json", sa.Text(), nullable=False),
        sa.Column("changed_by", sa.String(length=36), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["changed_by"],
            ["users.id"],
            name=op.f("fk_faq_entry_versions_changed_by_users"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["faq_entry_id"],
            ["faq_entries.id"],
            name=op.f("fk_faq_entry_versions_faq_entry_id_faq_entries"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_faq_entry_versions")),
    )
    op.create_index(
        op.f("ix_faq_entry_versions_faq_entry_id"),
        "faq_entry_versions",
        ["faq_entry_id"],
        unique=False,
    )
    op.create_table(
        "faq_feedback",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("faq_entry_id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=True),
        sa.Column("is_helpful", sa.Boolean(), nullable=False),
        sa.Column("comment", sa.String(length=1000), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["faq_entry_id"],
            ["faq_entries.id"],
            name=op.f("fk_faq_feedback_faq_entry_id_faq_entries"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_faq_feedback_user_id_users"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_faq_feedback")),
    )
    op.create_index(
        op.f("ix_faq_feedback_faq_entry_id"),
        "faq_feedback",
        ["faq_entry_id"],
        unique=False,
    )
    op.create_table(
        "assistant_query_logs",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("query_hash", sa.String(length=64), nullable=False),
        sa.Column("query_hint", sa.String(length=120), nullable=False),
        sa.Column("result_type", sa.String(length=24), nullable=False),
        sa.Column("faq_ids_json", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_assistant_query_logs")),
    )
    op.create_index(
        op.f("ix_assistant_query_logs_query_hash"),
        "assistant_query_logs",
        ["query_hash"],
        unique=False,
    )
    op.create_index(
        op.f("ix_assistant_query_logs_result_type"),
        "assistant_query_logs",
        ["result_type"],
        unique=False,
    )


def downgrade() -> None:
    connection = op.get_bind()
    op.drop_table("assistant_query_logs")
    op.drop_table("faq_feedback")
    op.drop_table("faq_entry_versions")
    if connection.dialect.name == "postgresql":
        op.execute("DROP INDEX IF EXISTS ix_faq_entries_search_tsv")
        op.execute("DROP INDEX IF EXISTS ix_faq_entries_question_trgm")
    op.drop_table("faq_entries")
    op.drop_table("faq_categories")
