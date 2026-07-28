from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


def new_id() -> str:
    return str(uuid.uuid4())


def utc_now() -> datetime:
    return datetime.now(UTC)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utc_now,
        onupdate=utc_now,
    )


class User(TimestampMixin, Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    vk_user_id: Mapped[int] = mapped_column(BigInteger, unique=True, index=True)
    display_name: Mapped[str] = mapped_column(String(160), default="")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    roles: Mapped[list[UserRole]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    def has_any_role(self, allowed: set[str]) -> bool:
        return any(user_role.role in allowed for user_role in self.roles)


class UserRole(Base):
    __tablename__ = "user_roles"

    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    role: Mapped[str] = mapped_column(String(32), primary_key=True)
    granted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    user: Mapped[User] = relationship(back_populates="roles")


class UserSession(Base):
    __tablename__ = "user_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    csrf_hash: Mapped[str] = mapped_column(String(64))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    user: Mapped[User] = relationship(lazy="selectin")

    @property
    def is_valid(self) -> bool:
        now = utc_now()
        expires_at = self.expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=UTC)
        return self.revoked_at is None and expires_at > now


class AuditLog(Base):
    __tablename__ = "audit_log"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    actor_user_id: Mapped[str | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        index=True,
    )
    operation: Mapped[str] = mapped_column(String(40), index=True)
    entity_type: Mapped[str] = mapped_column(String(80), index=True)
    entity_id: Mapped[str] = mapped_column(String(80), index=True)
    before_version: Mapped[int | None] = mapped_column(Integer)
    after_version: Mapped[int | None] = mapped_column(Integer)
    details_json: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    __table_args__ = (
        Index("ix_audit_log_entity", "entity_type", "entity_id", "created_at"),
    )


class FaqCategory(TimestampMixin, Base):
    __tablename__ = "faq_categories"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    source_key: Mapped[str] = mapped_column(String(160), unique=True)
    title: Mapped[str] = mapped_column(String(200))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    entries: Mapped[list[FaqEntry]] = relationship(back_populates="category", lazy="selectin")


class FaqEntry(TimestampMixin, Base):
    __tablename__ = "faq_entries"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    category_id: Mapped[str] = mapped_column(
        ForeignKey("faq_categories.id", ondelete="RESTRICT"),
        index=True,
    )
    question: Mapped[str] = mapped_column(String(500))
    answer_markdown: Mapped[str] = mapped_column(Text)
    search_keywords_json: Mapped[str] = mapped_column(Text, default="[]")
    source_key: Mapped[str] = mapped_column(String(220), unique=True, index=True)
    source_url: Mapped[str | None] = mapped_column(String(1000))
    status: Mapped[str] = mapped_column(String(24), default="needs_review", index=True)
    is_time_sensitive: Mapped[bool] = mapped_column(Boolean, default=False)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    valid_from: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    valid_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    created_by: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    updated_by: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    version: Mapped[int] = mapped_column(Integer, default=1)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    category: Mapped[FaqCategory] = relationship(back_populates="entries", lazy="selectin")

    __table_args__ = (
        Index("ix_faq_entries_public", "status", "valid_until", "deleted_at"),
    )


class FaqEntryVersion(Base):
    __tablename__ = "faq_entry_versions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    faq_entry_id: Mapped[str] = mapped_column(
        ForeignKey("faq_entries.id", ondelete="CASCADE"),
        index=True,
    )
    version: Mapped[int] = mapped_column(Integer)
    snapshot_json: Mapped[str] = mapped_column(Text)
    changed_by: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class FaqFeedback(Base):
    __tablename__ = "faq_feedback"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    faq_entry_id: Mapped[str] = mapped_column(
        ForeignKey("faq_entries.id", ondelete="CASCADE"),
        index=True,
    )
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    is_helpful: Mapped[bool] = mapped_column(Boolean)
    comment: Mapped[str] = mapped_column(String(1000), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class AssistantQueryLog(Base):
    __tablename__ = "assistant_query_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    query_hash: Mapped[str] = mapped_column(String(64), index=True)
    query_hint: Mapped[str] = mapped_column(String(120), default="")
    result_type: Mapped[str] = mapped_column(String(24), index=True)
    faq_ids_json: Mapped[str] = mapped_column(Text, default="[]")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class StudentGroup(TimestampMixin, Base):
    __tablename__ = "student_groups"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    code: Mapped[str] = mapped_column(String(80))
    normalized_code: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    academic_year: Mapped[str] = mapped_column(String(16), default="")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    valid_from: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    valid_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Tutor(TimestampMixin, Base):
    __tablename__ = "tutors"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    full_name: Mapped[str] = mapped_column(String(160))
    vk_user_id: Mapped[int | None] = mapped_column(BigInteger, unique=True)
    vk_url: Mapped[str] = mapped_column(String(500))
    description: Mapped[str] = mapped_column(String(500), default="")
    photo_url: Mapped[str | None] = mapped_column(String(1000))
    status: Mapped[str] = mapped_column(String(24), default="draft", index=True)
    valid_from: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    valid_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class GroupTutor(Base):
    __tablename__ = "group_tutors"

    group_id: Mapped[str] = mapped_column(
        ForeignKey("student_groups.id", ondelete="CASCADE"),
        primary_key=True,
    )
    tutor_id: Mapped[str] = mapped_column(
        ForeignKey("tutors.id", ondelete="CASCADE"),
        primary_key=True,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class UserGroupBookmark(Base):
    __tablename__ = "user_group_bookmarks"

    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    group_id: Mapped[str] = mapped_column(
        ForeignKey("student_groups.id", ondelete="CASCADE"),
        primary_key=True,
    )
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    group: Mapped[StudentGroup] = relationship(lazy="selectin")


class ResourceCategory(TimestampMixin, Base):
    __tablename__ = "resource_categories"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    slug: Mapped[str] = mapped_column(String(80), unique=True)
    title: Mapped[str] = mapped_column(String(120))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


class ResourceLink(TimestampMixin, Base):
    __tablename__ = "resource_links"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    category_id: Mapped[str] = mapped_column(
        ForeignKey("resource_categories.id", ondelete="RESTRICT"),
        index=True,
    )
    title: Mapped[str] = mapped_column(String(200))
    url: Mapped[str] = mapped_column(String(1000))
    description: Mapped[str] = mapped_column(String(500), default="")
    icon: Mapped[str] = mapped_column(String(80), default="link")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    category: Mapped[ResourceCategory] = relationship(lazy="selectin")
