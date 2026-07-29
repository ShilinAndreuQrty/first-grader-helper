from __future__ import annotations

import json
from datetime import UTC, datetime
from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import Settings, get_settings
from app.db import get_session
from app.knowledge.openrouter import OpenRouterFaqSelector
from app.knowledge.retrieval import (
    anonymized_query,
    is_publicly_available,
    public_entry,
)
from app.knowledge.schemas import (
    AssistantQuery,
    AssistantResponse,
    CategoryRead,
    FaqRead,
)
from app.knowledge.service import GroundedAssistantService
from app.models import AssistantQueryLog, FaqCategory, FaqEntry
from app.rate_limit import InMemoryRateLimiter

router = APIRouter(tags=["knowledge"])
limiter = InMemoryRateLimiter()


def public_filters(now: datetime) -> tuple:
    return (
        FaqEntry.status == "published",
        FaqEntry.deleted_at.is_(None),
        or_(FaqEntry.valid_from.is_(None), FaqEntry.valid_from <= now),
        or_(FaqEntry.valid_until.is_(None), FaqEntry.valid_until >= now),
    )


@router.get("/api/faq/categories", response_model=list[CategoryRead])
async def categories(db: Annotated[AsyncSession, Depends(get_session)]) -> list[CategoryRead]:
    now = datetime.now(UTC)
    rows = (
        await db.execute(
            select(FaqCategory.id, FaqCategory.title, func.count(FaqEntry.id))
            .join(FaqEntry)
            .where(*public_filters(now))
            .group_by(FaqCategory.id)
            .order_by(FaqCategory.sort_order)
        )
    ).all()
    return [CategoryRead(id=row[0], title=row[1], count=row[2]) for row in rows]


@router.get("/api/faq", response_model=list[FaqRead])
async def faq_list(
    db: Annotated[AsyncSession, Depends(get_session)],
    category_id: str | None = None,
    query: Annotated[str | None, Query(max_length=200)] = None,
) -> list[FaqRead]:
    now = datetime.now(UTC)
    statement = (
        select(FaqEntry)
        .options(selectinload(FaqEntry.category))
        .where(*public_filters(now))
        .order_by(FaqEntry.question)
        .limit(100)
    )
    if category_id:
        statement = statement.where(FaqEntry.category_id == category_id)
    if query:
        statement = statement.where(FaqEntry.question.ilike(f"%{query.strip()}%"))
    entries = list((await db.scalars(statement)).all())
    return [FaqRead.model_validate(public_entry(entry)) for entry in entries]


@router.get("/api/faq/{faq_id}", response_model=FaqRead)
async def faq_detail(
    faq_id: str,
    db: Annotated[AsyncSession, Depends(get_session)],
) -> FaqRead:
    entry = await db.scalar(
        select(FaqEntry)
        .options(selectinload(FaqEntry.category))
        .where(FaqEntry.id == faq_id)
    )
    if entry is None or not is_publicly_available(entry):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "FAQ entry not found")
    return FaqRead.model_validate(public_entry(entry))


@router.post("/api/assistant/query", response_model=AssistantResponse)
async def assistant_query(
    payload: AssistantQuery,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> AssistantResponse:
    host = request.client.host if request.client else "unknown"
    limiter.check(
        f"assistant:{host}",
        limit=settings.assistant_rate_limit_per_minute,
        window_seconds=60,
    )
    now = datetime.now(UTC)
    entries = list(
        (
            await db.scalars(
                select(FaqEntry)
                .options(selectinload(FaqEntry.category))
                .where(*public_filters(now))
            )
        ).all()
    )

    selector = None
    if settings.ai_assistant_enabled and await ai_budget_available(db, settings, now):
        client = httpx.AsyncClient(
            base_url=f"{settings.openrouter_base_url.rstrip('/')}/",
            timeout=settings.openrouter_timeout_seconds,
            headers={
                "Authorization": f"Bearer {settings.openrouter_api_key}",
                "HTTP-Referer": settings.app_public_url,
                "X-Title": settings.app_name,
            },
        )
        async with client:
            selector = OpenRouterFaqSelector(client, model=settings.openrouter_model)
            run = await GroundedAssistantService(
                selector,
                top_n=settings.assistant_top_n,
            ).answer(payload.text, entries, payload.selected_faq_id)
    else:
        run = await GroundedAssistantService(
            top_n=settings.assistant_top_n,
        ).answer(payload.text, entries, payload.selected_faq_id)

    result = run.result
    should_log = run.ai_attempted or result["type"] in {
        "not_found",
        "clarification",
    }
    if should_log:
        query_hash, query_hint = anonymized_query(payload.text)
        db.add(
            AssistantQueryLog(
                query_hash=query_hash,
                query_hint=query_hint,
                result_type=(
                    f"ai_{run.ai_status}" if run.ai_attempted else result["type"]
                ),
                faq_ids_json=json.dumps(result["faq_ids"]),
            )
        )
        await db.commit()
    return AssistantResponse.model_validate(result)


async def ai_budget_available(
    db: AsyncSession,
    settings: Settings,
    now: datetime,
) -> bool:
    if settings.openrouter_daily_request_limit == 0:
        return False
    day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    attempts = await db.scalar(
        select(func.count())
        .select_from(AssistantQueryLog)
        .where(
            AssistantQueryLog.created_at >= day_start,
            AssistantQueryLog.result_type.like("ai_%"),
        )
    )
    return int(attempts or 0) < settings.openrouter_daily_request_limit
