from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import ExternalScheduleCache
from app.schedule.client import TulsuClient, TulsuUnavailable
from app.schedule.schemas import (
    GroupSuggestionsRead,
    RawScheduleLesson,
    ScheduleLesson,
    ScheduleRead,
)

STALE_WARNING_AFTER = timedelta(hours=5)


def parse_tulsu_date(value: str):
    for pattern in ("%d.%m.%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(value, pattern).date()
        except ValueError:
            continue
    raise TulsuUnavailable("Invalid lesson date")


def normalize_lessons(rows: list[RawScheduleLesson]) -> list[ScheduleLesson]:
    return [
        ScheduleLesson(
            date=parse_tulsu_date(row.date_value),
            time=row.time_value.strip(),
            subject=row.subject.strip(),
            lesson_type=row.lesson_type.strip(),
            room=row.room.strip(),
            teacher=row.teacher.strip(),
        )
        for row in rows
    ]


def cache_is_fresh(cache: ExternalScheduleCache, now: datetime) -> bool:
    expires_at = cache.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=UTC)
    return expires_at > now


def cache_needs_stale_warning(
    cache: ExternalScheduleCache, now: datetime
) -> bool:
    fetched_at = cache.fetched_at
    if fetched_at.tzinfo is None:
        fetched_at = fetched_at.replace(tzinfo=UTC)
    return now - fetched_at > STALE_WARNING_AFTER


async def get_group_schedule(
    db: AsyncSession,
    client: TulsuClient,
    group_code: str,
    *,
    ttl_seconds: int,
) -> ScheduleRead:
    now = datetime.now(UTC)
    cache_key = f"group:{group_code}"
    cache = await db.scalar(
        select(ExternalScheduleCache).where(
            ExternalScheduleCache.cache_key == cache_key
        )
    )
    if cache and cache_is_fresh(cache, now):
        return ScheduleRead.model_validate_json(cache.payload_json)

    try:
        lessons = normalize_lessons(await client.schedule(group_code))
    except TulsuUnavailable:
        if cache:
            stale = ScheduleRead.model_validate_json(cache.payload_json)
            return stale.model_copy(
                update={"is_stale": cache_needs_stale_warning(cache, now)}
            )
        raise

    result = ScheduleRead(
        group_code=group_code,
        lessons=lessons,
        fetched_at=now,
        is_stale=False,
        source_url=f"https://tulsu.ru/schedule/?search={group_code}",
    )
    if cache:
        cache.payload_json = result.model_dump_json()
        cache.fetched_at = now
        cache.expires_at = now + timedelta(seconds=ttl_seconds)
    else:
        db.add(
            ExternalScheduleCache(
                cache_key=cache_key,
                payload_json=result.model_dump_json(),
                fetched_at=now,
                expires_at=now + timedelta(seconds=ttl_seconds),
            )
        )
    await db.commit()
    return result


async def get_group_suggestions(
    db: AsyncSession,
    client: TulsuClient,
    query: str,
    *,
    ttl_seconds: int,
) -> GroupSuggestionsRead:
    now = datetime.now(UTC)
    cache_key = f"group-search:{query}"
    cache = await db.scalar(
        select(ExternalScheduleCache).where(
            ExternalScheduleCache.cache_key == cache_key
        )
    )
    if cache and cache_is_fresh(cache, now):
        return GroupSuggestionsRead.model_validate_json(cache.payload_json)

    try:
        groups = await client.group_suggestions(query)
    except TulsuUnavailable:
        if cache:
            stale = GroupSuggestionsRead.model_validate_json(cache.payload_json)
            return stale.model_copy(
                update={"is_stale": cache_needs_stale_warning(cache, now)}
            )
        raise

    result = GroupSuggestionsRead(
        groups=groups,
        fetched_at=now,
        is_stale=False,
    )
    if cache:
        cache.payload_json = result.model_dump_json()
        cache.fetched_at = now
        cache.expires_at = now + timedelta(seconds=ttl_seconds)
    else:
        db.add(
            ExternalScheduleCache(
                cache_key=cache_key,
                payload_json=result.model_dump_json(),
                fetched_at=now,
                expires_at=now + timedelta(seconds=ttl_seconds),
            )
        )
    await db.commit()
    return result


def cached_payload(lessons: list[ScheduleLesson]) -> str:
    """Small helper used by fixtures without duplicating the public schema."""
    return json.dumps([item.model_dump(mode="json") for item in lessons])
