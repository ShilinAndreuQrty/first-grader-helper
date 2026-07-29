from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.admin.schemas import (
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
from app.models import (
    Announcement,
    AssistantQueryLog,
    AuditLog,
    CampusBuilding,
    Event,
    EventSeries,
    FaqEntry,
    FaqEntryVersion,
    IssueReport,
    OnboardingStep,
    ResourceCategory,
    ResourceLink,
    User,
    UserSession,
    new_id,
    utc_now,
)

router = APIRouter(prefix="/api/admin", tags=["admin"])
AdminUser = Annotated[
    User,
    Depends(require_roles("superadmin", "content_editor", "events_editor")),
]
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
        needs_review_faq=await count(
            select(func.count()).select_from(FaqEntry).where(
                FaqEntry.status == "needs_review",
                FaqEntry.deleted_at.is_(None),
            )
        ),
        upcoming_events=await count(
            select(func.count()).select_from(Event).where(
                Event.status == "published",
                Event.starts_at.between(now, now + timedelta(days=30)),
            )
        ),
        failed_assistant_queries=await count(
            select(func.count()).select_from(AssistantQueryLog).where(
                AssistantQueryLog.result_type.in_(("not_found", "clarification"))
            )
        ),
        unconfirmed_series=await count(
            select(func.count()).select_from(EventSeries).where(
                EventSeries.is_confirmed.is_(False),
                EventSeries.deleted_at.is_(None),
            )
        ),
        recent_audit=await count(
            select(func.count()).select_from(AuditLog).where(
                AuditLog.created_at >= now - timedelta(days=7)
            )
        ),
        open_issue_reports=await count(
            select(func.count()).select_from(IssueReport).where(
                IssueReport.status == "new"
            )
        ),
    )


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
