from __future__ import annotations

from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

from app.events.schemas import EventOccurrenceRead
from app.models import EventOccurrenceOverride, EventSeries


def as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def expand_weekly_series(
    series: EventSeries,
    overrides: list[EventOccurrenceOverride],
    range_start: datetime,
    range_end: datetime,
) -> list[EventOccurrenceRead]:
    """Expand the bounded weekly rule; overrides retain the original occurrence ID."""
    timezone = ZoneInfo(series.timezone or "Europe/Moscow")
    first_date = max(series.starts_on, range_start.astimezone(timezone).date())
    days_until_target = (series.recurrence_weekday - first_date.weekday()) % 7
    cursor = first_date + timedelta(days=days_until_target)
    by_original = {as_utc(item.original_start): item for item in overrides}
    result: list[EventOccurrenceRead] = []

    while cursor <= series.ends_on:
        local_start = datetime.combine(cursor, series.local_start_time, timezone)
        original_start = local_start.astimezone(UTC)
        if original_start >= range_end:
            break
        original_end = original_start + timedelta(minutes=series.duration_minutes)
        override = by_original.get(original_start)
        starts_at = (
            as_utc(override.replacement_start)
            if override and override.replacement_start
            else original_start
        )
        ends_at = (
            as_utc(override.replacement_end)
            if override and override.replacement_end
            else starts_at + (original_end - original_start)
        )
        status = override.status if override else "scheduled"
        if ends_at >= range_start:
            result.append(
                EventOccurrenceRead(
                    occurrence_id=f"{series.id}:{original_start.isoformat()}",
                    event_id=None,
                    series_id=series.id,
                    title=series.title,
                    description=series.description,
                    event_type=series.event_type,
                    starts_at=starts_at,
                    ends_at=ends_at,
                    all_day=False,
                    location=(
                        override.location
                        if override and override.location
                        else series.location
                    ),
                    organizer=series.organizer,
                    external_url=series.external_url,
                    status=status,
                    is_confirmed=(
                        bool(override.is_confirmed)
                        if override
                        else bool(series.is_confirmed)
                    ),
                )
            )
        cursor += timedelta(days=7)
    return result
