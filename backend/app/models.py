from __future__ import annotations

import uuid
from datetime import UTC, date, datetime, time

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
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
    first_name: Mapped[str] = mapped_column(String(80), default="")
    last_name: Mapped[str] = mapped_column(String(80), default="")
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
    app_variant: Mapped[str] = mapped_column(String(16), default="public", index=True)
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
    label: Mapped[str] = mapped_column(String(60), default="")
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
    slug: Mapped[str] = mapped_column(String(100), default="", index=True)
    title: Mapped[str] = mapped_column(String(200))
    url: Mapped[str] = mapped_column(String(1000))
    description: Mapped[str] = mapped_column(String(500), default="")
    icon: Mapped[str] = mapped_column(String(80), default="link")
    source_kind: Mapped[str] = mapped_column(String(24), default="student")
    contexts: Mapped[str] = mapped_column(String(300), default="catalog")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    category: Mapped[ResourceCategory] = relationship(lazy="selectin")


class EventSeries(TimestampMixin, Base):
    __tablename__ = "event_series"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    event_type: Mapped[str] = mapped_column(String(60), default="meeting", index=True)
    recurrence_weekday: Mapped[int] = mapped_column(Integer)
    local_start_time: Mapped[time] = mapped_column()
    duration_minutes: Mapped[int] = mapped_column(Integer, default=60)
    timezone: Mapped[str] = mapped_column(String(64), default="Europe/Moscow")
    starts_on: Mapped[date] = mapped_column()
    ends_on: Mapped[date] = mapped_column()
    location: Mapped[str] = mapped_column(String(300), default="")
    organizer: Mapped[str] = mapped_column(String(200), default="")
    external_url: Mapped[str | None] = mapped_column(String(1000))
    status: Mapped[str] = mapped_column(String(24), default="draft", index=True)
    is_confirmed: Mapped[bool] = mapped_column(Boolean, default=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Event(TimestampMixin, Base):
    __tablename__ = "events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    event_type: Mapped[str] = mapped_column(String(60), default="other", index=True)
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    all_day: Mapped[bool] = mapped_column(Boolean, default=False)
    location: Mapped[str] = mapped_column(String(300), default="")
    organizer: Mapped[str] = mapped_column(String(200), default="")
    external_url: Mapped[str | None] = mapped_column(String(1000))
    status: Mapped[str] = mapped_column(String(24), default="draft", index=True)
    occurrence_status: Mapped[str] = mapped_column(String(24), default="scheduled")
    is_confirmed: Mapped[bool] = mapped_column(Boolean, default=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    version: Mapped[int] = mapped_column(Integer, default=1)


class EventOccurrenceOverride(TimestampMixin, Base):
    __tablename__ = "event_occurrence_overrides"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    series_id: Mapped[str] = mapped_column(
        ForeignKey("event_series.id", ondelete="CASCADE"),
        index=True,
    )
    original_start: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    replacement_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    replacement_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(24), default="moved")
    location: Mapped[str | None] = mapped_column(String(300))
    is_confirmed: Mapped[bool] = mapped_column(Boolean, default=False)

    __table_args__ = (
        Index(
            "uq_event_override_series_start",
            "series_id",
            "original_start",
            unique=True,
        ),
    )


class EventSeriesBlackout(TimestampMixin, Base):
    """A verified pause in a recurring series, such as exams or summer break."""

    __tablename__ = "event_series_blackouts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    series_id: Mapped[str] = mapped_column(
        ForeignKey("event_series.id", ondelete="CASCADE"),
        index=True,
    )
    starts_on: Mapped[date] = mapped_column()
    ends_on: Mapped[date] = mapped_column()
    reason: Mapped[str] = mapped_column(String(300), default="")

    __table_args__ = (
        CheckConstraint(
            "ends_on >= starts_on",
            name="ck_event_series_blackout_dates",
        ),
    )


class EventSubscription(Base):
    __tablename__ = "event_subscriptions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
    )
    event_id: Mapped[str | None] = mapped_column(
        ForeignKey("events.id", ondelete="CASCADE"),
    )
    series_id: Mapped[str | None] = mapped_column(
        ForeignKey("event_series.id", ondelete="CASCADE"),
    )
    occurrence_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class CampusBuilding(TimestampMixin, Base):
    __tablename__ = "campus_buildings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    slug: Mapped[str] = mapped_column(
        String(80),
        default="",
        unique=True,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(200))
    short_name: Mapped[str] = mapped_column(String(80), unique=True)
    kind: Mapped[str] = mapped_column(String(24), default="academic", index=True)
    building_number: Mapped[str] = mapped_column(String(20), default="")
    address: Mapped[str] = mapped_column(String(300))
    entrance_hint: Mapped[str] = mapped_column(String(500), default="")
    aliases: Mapped[str] = mapped_column(String(500), default="[]")
    complex_slug: Mapped[str] = mapped_column(String(80), default="")
    dgis_url: Mapped[str] = mapped_column(String(1000))
    dgis_object_id: Mapped[str] = mapped_column(String(80), default="")
    dgis_complex_id: Mapped[str | None] = mapped_column(String(80))
    source_url: Mapped[str] = mapped_column(String(1000), default="")
    latitude: Mapped[str | None] = mapped_column(String(32))
    longitude: Mapped[str | None] = mapped_column(String(32))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(24), default="needs_review", index=True)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class CampusRoom(TimestampMixin, Base):
    __tablename__ = "campus_rooms"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    building_id: Mapped[str] = mapped_column(
        ForeignKey("campus_buildings.id", ondelete="CASCADE"),
        index=True,
    )
    room_number: Mapped[str] = mapped_column(String(40))
    title: Mapped[str] = mapped_column(String(160))
    floor: Mapped[str] = mapped_column(String(20), default="")
    directions: Mapped[str] = mapped_column(String(500), default="")
    status: Mapped[str] = mapped_column(String(24), default="needs_review", index=True)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    __table_args__ = (
        Index("uq_campus_room_building_number", "building_id", "room_number", unique=True),
    )


class Announcement(TimestampMixin, Base):
    __tablename__ = "announcements"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    title: Mapped[str] = mapped_column(String(200))
    body: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(24), default="draft", index=True)
    starts_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    importance: Mapped[str] = mapped_column(String(20), default="normal")
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class OnboardingStep(TimestampMixin, Base):
    __tablename__ = "onboarding_steps"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    slug: Mapped[str] = mapped_column(String(100), unique=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(String(500), default="")
    action_path: Mapped[str] = mapped_column(String(300), default="")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(24), default="draft", index=True)
    valid_from: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    valid_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ExternalScheduleCache(Base):
    __tablename__ = "external_schedule_cache"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    cache_key: Mapped[str] = mapped_column(String(180), unique=True, index=True)
    payload_json: Mapped[str] = mapped_column(Text)
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)


class NotificationPreference(TimestampMixin, Base):
    __tablename__ = "notification_preferences"

    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    union_meetings: Mapped[bool] = mapped_column(Boolean, default=False)
    selected_events: Mapped[bool] = mapped_column(Boolean, default=False)
    announcements: Mapped[bool] = mapped_column(Boolean, default=False)
    minutes_before: Mapped[int] = mapped_column(Integer, default=60)
    in_app_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    vk_notifications_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    community_messages_enabled: Mapped[bool] = mapped_column(Boolean, default=False)


class NotificationJob(TimestampMixin, Base):
    __tablename__ = "notification_jobs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    idempotency_key: Mapped[str] = mapped_column(String(220), unique=True, index=True)
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
    )
    event_id: Mapped[str | None] = mapped_column(
        ForeignKey("events.id", ondelete="CASCADE"),
    )
    series_id: Mapped[str | None] = mapped_column(
        ForeignKey("event_series.id", ondelete="CASCADE"),
    )
    occurrence_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    scheduled_for: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    channel: Mapped[str] = mapped_column(String(32), default="in_app")
    payload_json: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(24), default="pending", index=True)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    locked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_error: Mapped[str] = mapped_column(String(200), default="")


class NotificationDelivery(Base):
    __tablename__ = "notification_deliveries"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    job_id: Mapped[str] = mapped_column(
        ForeignKey("notification_jobs.id", ondelete="CASCADE"),
        unique=True,
        index=True,
    )
    provider: Mapped[str] = mapped_column(String(40))
    status: Mapped[str] = mapped_column(String(24), index=True)
    provider_message_id: Mapped[str] = mapped_column(String(160), default="")
    error_code: Mapped[str] = mapped_column(String(80), default="")
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class UserOnboardingProgress(Base):
    __tablename__ = "user_onboarding_progress"

    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    step_id: Mapped[str] = mapped_column(
        ForeignKey("onboarding_steps.id", ondelete="CASCADE"),
        primary_key=True,
    )
    completed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class IssueReport(Base):
    __tablename__ = "issue_reports"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    user_id: Mapped[str | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        index=True,
    )
    context: Mapped[str] = mapped_column(String(100), index=True)
    message: Mapped[str] = mapped_column(String(2000))
    status: Mapped[str] = mapped_column(String(24), default="new", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
