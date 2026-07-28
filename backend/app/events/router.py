from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import require_csrf
from app.db import get_session
from app.events.schemas import EventOccurrenceRead, EventSubscriptionCreate
from app.events.service import as_utc, expand_weekly_series
from app.models import (
    Event,
    EventOccurrenceOverride,
    EventSeries,
    EventSubscription,
    UserSession,
)

router = APIRouter(tags=["events"])


@router.get("/api/events", response_model=list[EventOccurrenceRead])
async def public_events(
    db: Annotated[AsyncSession, Depends(get_session)],
    date_from: Annotated[datetime | None, Query()] = None,
    date_to: Annotated[datetime | None, Query()] = None,
    event_type: Annotated[str | None, Query(max_length=60)] = None,
) -> list[EventOccurrenceRead]:
    now = datetime.now(UTC)
    range_start = as_utc(date_from or now)
    range_end = as_utc(date_to or range_start + timedelta(days=60))
    if range_end <= range_start or range_end - range_start > timedelta(days=120):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Invalid date range")

    event_statement = select(Event).where(
        Event.status == "published",
        Event.deleted_at.is_(None),
        Event.ends_at >= range_start,
        Event.starts_at < range_end,
    )
    series_statement = select(EventSeries).where(
        EventSeries.status == "published",
        EventSeries.deleted_at.is_(None),
        EventSeries.ends_on >= range_start.date(),
        EventSeries.starts_on <= range_end.date(),
    )
    if event_type:
        event_statement = event_statement.where(Event.event_type == event_type)
        series_statement = series_statement.where(EventSeries.event_type == event_type)

    events = list((await db.scalars(event_statement)).all())
    series_rows = list((await db.scalars(series_statement)).all())
    occurrences = [
        EventOccurrenceRead(
            occurrence_id=event.id,
            event_id=event.id,
            series_id=None,
            title=event.title,
            description=event.description,
            event_type=event.event_type,
            starts_at=as_utc(event.starts_at),
            ends_at=as_utc(event.ends_at),
            all_day=event.all_day,
            location=event.location,
            organizer=event.organizer,
            external_url=event.external_url,
            status=(
                "completed"
                if as_utc(event.ends_at) < now and event.status == "published"
                else "scheduled"
            ),
            is_confirmed=event.is_confirmed,
        )
        for event in events
    ]
    for series in series_rows:
        overrides = list(
            (
                await db.scalars(
                    select(EventOccurrenceOverride).where(
                        EventOccurrenceOverride.series_id == series.id,
                        or_(
                            EventOccurrenceOverride.original_start >= range_start
                            - timedelta(days=7),
                            EventOccurrenceOverride.replacement_start >= range_start,
                        ),
                    )
                )
            ).all()
        )
        occurrences.extend(
            expand_weekly_series(series, overrides, range_start, range_end)
        )
    return sorted(occurrences, key=lambda item: item.starts_at)


@router.post(
    "/api/event-subscriptions",
    status_code=status.HTTP_201_CREATED,
)
async def subscribe_to_event(
    payload: EventSubscriptionCreate,
    user_session: Annotated[UserSession, Depends(require_csrf)],
    db: Annotated[AsyncSession, Depends(get_session)],
) -> dict[str, str]:
    if bool(payload.event_id) == bool(payload.series_id):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "Choose exactly one event or series",
        )
    existing = await db.scalar(
        select(EventSubscription).where(
            EventSubscription.user_id == user_session.user_id,
            EventSubscription.event_id == payload.event_id,
            EventSubscription.series_id == payload.series_id,
            EventSubscription.occurrence_start == payload.occurrence_start,
        )
    )
    if existing:
        existing.is_active = True
        subscription = existing
    else:
        subscription = EventSubscription(
            user_id=user_session.user_id,
            event_id=payload.event_id,
            series_id=payload.series_id,
            occurrence_start=payload.occurrence_start,
        )
        db.add(subscription)
    await db.commit()
    return {"id": subscription.id}

