from __future__ import annotations

import json
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db import get_session
from app.knowledge.retrieval import (
    DeterministicRetrievalProvider,
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
from app.models import AssistantQueryLog, FaqCategory, FaqEntry
from app.rate_limit import InMemoryRateLimiter

router = APIRouter(tags=["knowledge"])
provider = DeterministicRetrievalProvider()
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
) -> AssistantResponse:
    host = request.client.host if request.client else "unknown"
    limiter.check(f"assistant:{host}", limit=30, window_seconds=60)
    entries = list(
        (
            await db.scalars(
                select(FaqEntry)
                .options(selectinload(FaqEntry.category))
                .where(FaqEntry.status == "published", FaqEntry.deleted_at.is_(None))
            )
        ).all()
    )
    result = provider.answer(payload.text, entries, payload.selected_faq_id)
    if result["type"] in {"not_found", "clarification"}:
        query_hash, query_hint = anonymized_query(payload.text)
        db.add(
            AssistantQueryLog(
                query_hash=query_hash,
                query_hint=query_hint,
                result_type=result["type"],
                faq_ids_json=json.dumps(result["faq_ids"]),
            )
        )
        await db.commit()
    return AssistantResponse.model_validate(result)
