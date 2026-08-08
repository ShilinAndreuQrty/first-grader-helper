from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta
from typing import Annotated, Any
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.admin.schemas import (
    AdminEventRead,
    AdminFeedbackRead,
    AdminStudentRead,
    AnnouncementWrite,
    BuildingWrite,
    DashboardRead,
    EventWrite,
    FaqAdminRead,
    FaqUpdate,
    OnboardingStepWrite,
    ResourceWrite,
)
from app.auth.dependencies import require_csrf, require_roles
from app.db import get_session
from app.events.service import as_utc
from app.models import (
    Announcement,
    AuditLog,
    CampusBuilding,
    Event,
    EventSubscription,
    FaqEntry,
    FaqEntryVersion,
    FaqFeedback,
    IssueReport,
    NotificationDelivery,
    NotificationJob,
    NotificationPreference,
    OnboardingStep,
    ResourceCategory,
    ResourceLink,
    StudentGroup,
    User,
    UserGroupBookmark,
    UserOnboardingProgress,
    UserSession,
    new_id,
    utc_now,
)
from app.notifications.service import enqueue_once

router = APIRouter(prefix="/api/admin", tags=["admin"])
AdminUser = Annotated[
    User,
    Depends(require_roles("superadmin", "content_editor", "events_editor")),
]
SuperadminUser = Annotated[User, Depends(require_roles("superadmin"))]
ContentUser = Annotated[
    User,
    Depends(require_roles("superadmin", "content_editor")),
]
EventsUser = Annotated[
    User,
    Depends(require_roles("superadmin", "events_editor")),
]
CsrfSession = Annotated[UserSession, Depends(require_csrf)]
Db = Annotated[AsyncSession, Depends(get_session)]


def add_audit(
    db: AsyncSession,
    actor: User,
    operation: str,
    entity: Any,
    *,
    before_version: int | None = None,
    after_version: int | None = None,
    details: dict[str, Any] | None = None,
) -> None:
    db.add(
        AuditLog(
            actor_user_id=actor.id,
            operation=operation,
            entity_type=entity.__class__.__name__,
            entity_id=entity.id,
            before_version=before_version,
            after_version=after_version,
            details_json=json.dumps(details or {}, ensure_ascii=False),
        )
    )


@router.get("/dashboard", response_model=DashboardRead)
async def dashboard(_: AdminUser, db: Db) -> DashboardRead:
    now = datetime.now(UTC)

    async def count(statement: Any) -> int:
        return int(await db.scalar(statement) or 0)

    return DashboardRead(
        upcoming_events=await count(
            select(func.count()).select_from(Event).where(
                Event.status == "published",
                Event.starts_at.between(now, now + timedelta(days=30)),
            )
        ),
        active_registrations=await count(
            select(func.count()).select_from(EventSubscription).where(
                EventSubscription.is_active.is_(True)
            )
        ),
        registered_users=await count(
            select(func.count(func.distinct(EventSubscription.user_id))).where(
                EventSubscription.is_active.is_(True)
            )
        ),
        cancelled_events=await count(
            select(func.count()).select_from(Event).where(
                Event.status == "published",
                Event.occurrence_status == "cancelled",
                Event.starts_at >= now - timedelta(days=30),
            )
        ),
        recent_audit=await count(
            select(func.count()).select_from(AuditLog).where(
                AuditLog.created_at >= now - timedelta(days=7)
            )
        ),
    )


def event_read(event: Event, registration_count: int) -> AdminEventRead:
    return AdminEventRead(
        id=event.id,
        title=event.title,
        description=event.description,
        event_type=event.event_type,
        starts_at=as_utc(event.starts_at),
        ends_at=as_utc(event.ends_at),
        location=event.location,
        organizer=event.organizer,
        external_url=event.external_url,
        status=event.status,
        occurrence_status=event.occurrence_status,
        is_confirmed=event.is_confirmed,
        version=event.version,
        registration_count=registration_count,
    )


async def notify_event_subscribers(db: AsyncSession, event: Event) -> None:
    subscribers = list(
        (
            await db.scalars(
                select(EventSubscription).where(
                    EventSubscription.event_id == event.id,
                    EventSubscription.is_active.is_(True),
                )
            )
        ).all()
    )
    cancelled = event.occurrence_status == "cancelled"
    local_start = event.starts_at.astimezone(ZoneInfo("Europe/Moscow"))
    details = local_start.strftime("%d.%m в %H:%M")
    if event.location:
        details = f"{details}, {event.location}"
    for subscription in subscribers:
        await enqueue_once(
            db,
            idempotency_key=(
                f"event-{'cancelled' if cancelled else 'updated'}:"
                f"{event.id}:{event.version}:{subscription.user_id}"
            ),
            user_id=subscription.user_id,
            scheduled_for=datetime.now(UTC),
            title="Мероприятие отменено" if cancelled else "Мероприятие обновлено",
            body=f"{event.title} — {details}",
            event_id=event.id,
        )


@router.get("/users", response_model=list[AdminStudentRead])
async def admin_users(_: SuperadminUser, db: Db) -> list[AdminStudentRead]:
    primary_group = (
        select(
            UserGroupBookmark.user_id.label("user_id"),
            StudentGroup.code.label("group_code"),
        )
        .join(StudentGroup, StudentGroup.id == UserGroupBookmark.group_id)
        .where(UserGroupBookmark.is_primary.is_(True))
        .subquery()
    )
    last_activity = (
        select(
            UserSession.user_id.label("user_id"),
            func.max(UserSession.last_seen_at).label("last_seen_at"),
        )
        .group_by(UserSession.user_id)
        .subquery()
    )
    rows = (
        await db.execute(
            select(
                User,
                primary_group.c.group_code,
                last_activity.c.last_seen_at,
            )
            .outerjoin(primary_group, primary_group.c.user_id == User.id)
            .outerjoin(last_activity, last_activity.c.user_id == User.id)
            .order_by(User.created_at.desc())
            .limit(500)
        )
    ).all()
    return [
        AdminStudentRead(
            id=user.id,
            vk_user_id=user.vk_user_id,
            display_name=user.display_name or f"VK ID {user.vk_user_id}",
            profile_url=f"https://vk.ru/id{user.vk_user_id}",
            primary_group=group_code,
            first_login_at=user.created_at,
            last_activity_at=last_seen_at,
        )
        for user, group_code, last_seen_at in rows
    ]


@router.get("/feedback", response_model=list[AdminFeedbackRead])
async def admin_feedback(_: AdminUser, db: Db) -> list[AdminFeedbackRead]:
    rows = (
        await db.execute(
            select(IssueReport, User)
            .outerjoin(User, User.id == IssueReport.user_id)
            .where(IssueReport.context == "project-feedback")
            .order_by(IssueReport.created_at.desc())
            .limit(200)
        )
    ).all()
    return [
        AdminFeedbackRead(
            id=feedback.id,
            message=feedback.message,
            status=feedback.status,
            created_at=feedback.created_at,
            user_name=(user.display_name or f"VK ID {user.vk_user_id}") if user else "Пользователь",
            profile_url=f"https://vk.ru/id{user.vk_user_id}" if user else None,
        )
        for feedback, user in rows
    ]


@router.post("/demo/reset-me", status_code=status.HTTP_204_NO_CONTENT)
async def reset_current_admin_demo_data(
    actor: AdminUser,
    _: CsrfSession,
    db: Db,
) -> None:
    notification_job_ids = select(NotificationJob.id).where(
        NotificationJob.user_id == actor.id
    )
    await db.execute(
        delete(NotificationDelivery).where(
            NotificationDelivery.job_id.in_(notification_job_ids)
        )
    )
    for model in (
        NotificationJob,
        EventSubscription,
        NotificationPreference,
        UserOnboardingProgress,
        UserGroupBookmark,
        FaqFeedback,
    ):
        await db.execute(delete(model).where(model.user_id == actor.id))
    await db.execute(
        update(IssueReport)
        .where(IssueReport.user_id == actor.id)
        .values(user_id=None)
    )
    add_audit(
        db,
        actor,
        "reset_demo_data",
        actor,
        details={"preserved": ["account", "roles", "sessions", "events"]},
    )
    await db.commit()


@router.get("/faq", response_model=list[FaqAdminRead])
async def admin_faq(_: AdminUser, db: Db) -> list[FaqAdminRead]:
    rows = list(
        (
            await db.scalars(
                select(FaqEntry)
                .where(FaqEntry.deleted_at.is_(None))
                .order_by(FaqEntry.status.desc(), FaqEntry.question)
            )
        ).all()
    )
    return [
        FaqAdminRead(
            id=row.id,
            question=row.question,
            status=row.status,
            version=row.version,
            verified_at=row.verified_at,
            is_time_sensitive=row.is_time_sensitive,
        )
        for row in rows
    ]


@router.put("/faq/{faq_id}", response_model=FaqAdminRead)
async def update_faq(
    faq_id: str,
    payload: FaqUpdate,
    actor: ContentUser,
    _: CsrfSession,
    db: Db,
) -> FaqAdminRead:
    entry = await db.get(FaqEntry, faq_id)
    if entry is None or entry.deleted_at:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "FAQ entry not found")
    before = {
        "question": entry.question,
        "answer_markdown": entry.answer_markdown,
        "status": entry.status,
        "version": entry.version,
    }
    db.add(
        FaqEntryVersion(
            faq_entry_id=entry.id,
            version=entry.version,
            snapshot_json=json.dumps(before, ensure_ascii=False),
            changed_by=actor.id,
        )
    )
    previous_version = entry.version
    entry.question = payload.question
    entry.answer_markdown = payload.answer_markdown
    entry.search_keywords_json = json.dumps(payload.search_keywords, ensure_ascii=False)
    entry.source_url = str(payload.source_url) if payload.source_url else None
    entry.status = payload.status
    entry.is_time_sensitive = payload.is_time_sensitive
    entry.verified_at = payload.verified_at
    entry.updated_by = actor.id
    entry.version += 1
    add_audit(
        db,
        actor,
        "update",
        entry,
        before_version=previous_version,
        after_version=entry.version,
        details={"status": payload.status},
    )
    await db.commit()
    return FaqAdminRead(
        id=entry.id,
        question=entry.question,
        status=entry.status,
        version=entry.version,
        verified_at=entry.verified_at,
        is_time_sensitive=entry.is_time_sensitive,
    )


@router.delete("/faq/{faq_id}", status_code=status.HTTP_204_NO_CONTENT)
async def archive_faq(
    faq_id: str,
    actor: ContentUser,
    _: CsrfSession,
    db: Db,
) -> None:
    entry = await db.get(FaqEntry, faq_id)
    if entry is None:
        return
    previous = entry.version
    entry.status = "archived"
    entry.deleted_at = utc_now()
    entry.version += 1
    add_audit(
        db,
        actor,
        "archive",
        entry,
        before_version=previous,
        after_version=entry.version,
    )
    await db.commit()


@router.post("/events", status_code=status.HTTP_201_CREATED)
async def create_event(
    payload: EventWrite,
    actor: EventsUser,
    _: CsrfSession,
    db: Db,
) -> dict[str, str]:
    event = Event(
        title=payload.title,
        description=payload.description,
        event_type=payload.event_type,
        starts_at=payload.starts_at,
        ends_at=payload.ends_at,
        location=payload.location,
        organizer=payload.organizer,
        external_url=str(payload.external_url) if payload.external_url else None,
        status=payload.status,
        occurrence_status=payload.occurrence_status,
        is_confirmed=payload.is_confirmed,
    )
    db.add(event)
    await db.flush()
    add_audit(db, actor, "create", event, after_version=event.version)
    await db.commit()
    return {"id": event.id}


@router.get("/events", response_model=list[AdminEventRead])
async def admin_events(_: EventsUser, db: Db) -> list[AdminEventRead]:
    registrations = (
        select(
            EventSubscription.event_id.label("event_id"),
            func.count(EventSubscription.id).label("registration_count"),
        )
        .where(EventSubscription.is_active.is_(True))
        .group_by(EventSubscription.event_id)
        .subquery()
    )
    rows = (
        await db.execute(
            select(Event, func.coalesce(registrations.c.registration_count, 0))
            .outerjoin(registrations, registrations.c.event_id == Event.id)
            .where(Event.deleted_at.is_(None))
            .order_by(Event.starts_at.desc())
            .limit(200)
        )
    ).all()
    return [event_read(event, int(count)) for event, count in rows]


@router.put("/events/{event_id}", response_model=AdminEventRead)
async def update_event(
    event_id: str,
    payload: EventWrite,
    actor: EventsUser,
    _: CsrfSession,
    db: Db,
) -> AdminEventRead:
    event = await db.get(Event, event_id)
    if event is None or event.deleted_at is not None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")

    previous_version = event.version
    for field, value in payload.model_dump().items():
        if field == "external_url":
            value = str(value) if value else None
        setattr(event, field, value)
    event.version += 1
    add_audit(
        db,
        actor,
        "cancel" if event.occurrence_status == "cancelled" else "update",
        event,
        before_version=previous_version,
        after_version=event.version,
    )
    await notify_event_subscribers(db, event)
    await db.commit()
    registration_count = int(
        await db.scalar(
            select(func.count()).select_from(EventSubscription).where(
                EventSubscription.event_id == event.id,
                EventSubscription.is_active.is_(True),
            )
        )
        or 0
    )
    return event_read(event, registration_count)


@router.delete("/events/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_cancelled_event(
    event_id: str,
    actor: EventsUser,
    _: CsrfSession,
    db: Db,
) -> None:
    event = await db.get(Event, event_id)
    if event is None or event.deleted_at is not None:
        return
    if event.occurrence_status != "cancelled":
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Only cancelled events can be deleted",
        )
    previous_version = event.version
    event.deleted_at = utc_now()
    event.status = "archived"
    event.version += 1
    add_audit(
        db,
        actor,
        "delete",
        event,
        before_version=previous_version,
        after_version=event.version,
    )
    await db.commit()


@router.post("/resources", status_code=status.HTTP_201_CREATED)
async def create_resource(
    payload: ResourceWrite,
    actor: ContentUser,
    _: CsrfSession,
    db: Db,
) -> dict[str, str]:
    if await db.get(ResourceCategory, payload.category_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Resource category not found")
    link = ResourceLink(
        category_id=payload.category_id,
        title=payload.title,
        url=str(payload.url),
        description=payload.description,
        icon=payload.icon,
        sort_order=payload.sort_order,
        is_active=payload.is_active,
    )
    db.add(link)
    await db.flush()
    add_audit(db, actor, "create", link)
    await db.commit()
    return {"id": link.id}


@router.post("/buildings", status_code=status.HTTP_201_CREATED)
async def create_building(
    payload: BuildingWrite,
    actor: ContentUser,
    _: CsrfSession,
    db: Db,
) -> dict[str, str]:
    building_id = new_id()
    building = CampusBuilding(
        id=building_id,
        slug=f"draft-{building_id}",
        name=payload.name,
        short_name=payload.short_name,
        building_number=payload.building_number,
        address=payload.address,
        entrance_hint=payload.entrance_hint,
        aliases=json.dumps(payload.aliases, ensure_ascii=False),
        dgis_url=str(payload.dgis_url),
        source_url=str(payload.source_url) if payload.source_url else "",
        latitude=str(payload.latitude) if payload.latitude is not None else None,
        longitude=str(payload.longitude) if payload.longitude is not None else None,
        status=payload.status,
        verified_at=utc_now() if payload.status == "published" else None,
    )
    db.add(building)
    await db.flush()
    add_audit(db, actor, "create", building)
    await db.commit()
    return {"id": building.id}


@router.post("/announcements", status_code=status.HTTP_201_CREATED)
async def create_announcement(
    payload: AnnouncementWrite,
    actor: ContentUser,
    _: CsrfSession,
    db: Db,
) -> dict[str, str]:
    announcement = Announcement(**payload.model_dump())
    db.add(announcement)
    await db.flush()
    add_audit(db, actor, "create", announcement)
    await db.commit()
    return {"id": announcement.id}


@router.post("/onboarding", status_code=status.HTTP_201_CREATED)
async def create_onboarding_step(
    payload: OnboardingStepWrite,
    actor: ContentUser,
    _: CsrfSession,
    db: Db,
) -> dict[str, str]:
    step = OnboardingStep(**payload.model_dump())
    db.add(step)
    await db.flush()
    add_audit(db, actor, "create", step)
    await db.commit()
    return {"id": step.id}


@router.get("/audit")
async def audit_log(_: AdminUser, db: Db) -> list[dict[str, Any]]:
    rows = list(
        (
            await db.scalars(
                select(AuditLog).order_by(AuditLog.created_at.desc()).limit(100)
            )
        ).all()
    )
    return [
        {
            "id": row.id,
            "actor_user_id": row.actor_user_id,
            "operation": row.operation,
            "entity_type": row.entity_type,
            "entity_id": row.entity_id,
            "before_version": row.before_version,
            "after_version": row.after_version,
            "created_at": row.created_at,
        }
        for row in rows
    ]
