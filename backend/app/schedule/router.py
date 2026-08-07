from __future__ import annotations

from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import require_csrf
from app.config import Settings, get_settings
from app.db import get_session
from app.models import StudentGroup, UserGroupBookmark, UserSession
from app.rate_limit import InMemoryRateLimiter
from app.schedule.client import TulsuClient, TulsuUnavailable
from app.schedule.schemas import (
    CalendarPeriod,
    GroupCodeCreate,
    GroupSuggestionsRead,
    ScheduleRead,
)
from app.schedule.service import get_group_schedule, get_group_suggestions
from app.students.schemas import GroupRead
from app.students.service import normalize_bookmark_label, require_valid_group_code

router = APIRouter(prefix="/api", tags=["schedule"])
limiter = InMemoryRateLimiter()


def client_key(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def tulsu_http_client(settings: Settings) -> httpx.AsyncClient:
    return httpx.AsyncClient(
        base_url=settings.tulsu_schedule_base_url.rstrip("/"),
        timeout=settings.tulsu_timeout_seconds,
        follow_redirects=False,
        headers={"User-Agent": "IPMKN-Start/0.1 schedule-adapter"},
    )


def valid_group_code(value: str) -> str:
    try:
        return require_valid_group_code(value)
    except ValueError as error:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "Номер группы: шесть цифр и, при наличии, дефис с двумя цифрами",
        ) from error


@router.get("/schedule/groups", response_model=GroupSuggestionsRead)
async def schedule_groups(
    query: str,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> GroupSuggestionsRead:
    if not 1 <= len(query) <= 80:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Invalid query")
    normalized = valid_group_code(query)
    limiter.check(f"schedule-search:{client_key(request)}", limit=20, window_seconds=60)
    async with tulsu_http_client(settings) as http:
        try:
            return await get_group_suggestions(
                db,
                TulsuClient(http),
                normalized,
                ttl_seconds=settings.tulsu_cache_ttl_seconds,
            )
        except TulsuUnavailable as error:
            raise HTTPException(
                status.HTTP_503_SERVICE_UNAVAILABLE,
                "Расписание ТулГУ временно недоступно",
            ) from error


@router.post("/me/groups/by-code", response_model=GroupRead)
async def save_discovered_group(
    payload: GroupCodeCreate,
    user_session: Annotated[UserSession, Depends(require_csrf)],
    db: Annotated[AsyncSession, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> GroupRead:
    normalized = valid_group_code(payload.code)
    async with tulsu_http_client(settings) as http:
        try:
            suggestions = await get_group_suggestions(
                db,
                TulsuClient(http),
                normalized,
                ttl_seconds=settings.tulsu_cache_ttl_seconds,
            )
        except TulsuUnavailable as error:
            raise HTTPException(
                status.HTTP_503_SERVICE_UNAVAILABLE,
                "Не удалось проверить группу в ТулГУ",
            ) from error
    exact = next(
        (item for item in suggestions.groups if item == normalized),
        None,
    )
    if exact is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Group not found")

    group = await db.scalar(
        select(StudentGroup).where(StudentGroup.normalized_code == normalized)
    )
    if group is None:
        group = StudentGroup(
            code=exact,
            normalized_code=normalized,
            academic_year="",
        )
        db.add(group)
        await db.flush()
    if payload.is_primary:
        await db.execute(
            update(UserGroupBookmark)
            .where(UserGroupBookmark.user_id == user_session.user_id)
            .values(is_primary=False)
        )
    bookmark = await db.get(
        UserGroupBookmark,
        {"user_id": user_session.user_id, "group_id": group.id},
    )
    if bookmark:
        bookmark.is_primary = payload.is_primary or bookmark.is_primary
        if payload.label is not None:
            bookmark.label = normalize_bookmark_label(payload.label)
    else:
        bookmark = UserGroupBookmark(
            user_id=user_session.user_id,
            group_id=group.id,
            is_primary=payload.is_primary,
            label=normalize_bookmark_label(payload.label or ""),
        )
        db.add(bookmark)
    await db.commit()
    return GroupRead(
        id=group.id,
        code=group.code,
        academic_year=group.academic_year,
        is_primary=bookmark.is_primary,
        label=bookmark.label,
    )


@router.get("/schedule/{group_code}", response_model=ScheduleRead)
async def group_schedule(
    group_code: str,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> ScheduleRead:
    limiter.check(f"schedule:{client_key(request)}", limit=30, window_seconds=60)
    normalized = valid_group_code(group_code)
    async with tulsu_http_client(settings) as http:
        try:
            return await get_group_schedule(
                db,
                TulsuClient(http),
                normalized,
                ttl_seconds=settings.tulsu_cache_ttl_seconds,
            )
        except TulsuUnavailable as error:
            raise HTTPException(
                status.HTTP_503_SERVICE_UNAVAILABLE,
                "Расписание ТулГУ временно недоступно",
            ) from error


@router.get("/schedule/{group_code}/calendar", response_model=list[CalendarPeriod])
async def academic_calendar(
    group_code: str,
    settings: Annotated[Settings, Depends(get_settings)],
) -> list[CalendarPeriod]:
    normalized = valid_group_code(group_code)
    async with tulsu_http_client(settings) as http:
        try:
            return await TulsuClient(http).calendar(normalized)
        except TulsuUnavailable as error:
            raise HTTPException(
                status.HTTP_503_SERVICE_UNAVAILABLE,
                "Календарь ТулГУ временно недоступен",
            ) from error
