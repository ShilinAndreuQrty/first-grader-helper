from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import delete, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.auth.dependencies import get_current_user, require_csrf
from app.db import get_session
from app.models import (
    GroupTutor,
    ResourceCategory,
    ResourceLink,
    StudentGroup,
    Tutor,
    User,
    UserGroupBookmark,
    UserSession,
)
from app.students.schemas import BookmarkCreate, GroupRead, ResourceRead, TutorRead
from app.students.service import normalize_group_code

router = APIRouter(tags=["students"])


@router.get("/api/groups", response_model=list[GroupRead])
async def groups(
    db: Annotated[AsyncSession, Depends(get_session)],
    query: Annotated[str, Query(min_length=1, max_length=80)] = "",
) -> list[GroupRead]:
    statement = (
        select(StudentGroup)
        .where(StudentGroup.is_active.is_(True))
        .order_by(StudentGroup.code)
        .limit(20)
    )
    if query:
        statement = statement.where(
            StudentGroup.normalized_code.contains(normalize_group_code(query))
        )
    rows = list((await db.scalars(statement)).all())
    return [
        GroupRead(id=row.id, code=row.code, academic_year=row.academic_year)
        for row in rows
    ]


@router.get("/api/groups/{group_id}/tutors", response_model=list[TutorRead])
async def group_tutors(
    group_id: str,
    db: Annotated[AsyncSession, Depends(get_session)],
) -> list[TutorRead]:
    now = datetime.now(UTC)
    rows = list(
        (
            await db.scalars(
                select(Tutor)
                .join(GroupTutor)
                .where(
                    GroupTutor.group_id == group_id,
                    Tutor.status == "published",
                    Tutor.deleted_at.is_(None),
                    or_(Tutor.valid_from.is_(None), Tutor.valid_from <= now),
                    or_(Tutor.valid_until.is_(None), Tutor.valid_until >= now),
                )
                .order_by(Tutor.full_name)
            )
        ).all()
    )
    return [
        TutorRead(
            id=row.id,
            full_name=row.full_name,
            vk_url=row.vk_url,
            description=row.description,
            photo_url=row.photo_url,
            valid_until=row.valid_until,
        )
        for row in rows
    ]


@router.get("/api/resources", response_model=list[ResourceRead])
async def resources(db: Annotated[AsyncSession, Depends(get_session)]) -> list[ResourceRead]:
    rows = list(
        (
            await db.scalars(
                select(ResourceLink)
                .options(selectinload(ResourceLink.category))
                .where(
                    ResourceLink.is_active.is_(True),
                    ResourceLink.deleted_at.is_(None),
                )
                .join(ResourceCategory)
                .order_by(ResourceCategory.sort_order, ResourceLink.sort_order)
            )
        ).all()
    )
    return [
        ResourceRead(
            id=row.id,
            slug=row.slug,
            category=row.category.title,
            category_slug=row.category.slug,
            title=row.title,
            url=row.url,
            description=row.description,
            icon=row.icon,
            source_kind=row.source_kind,
            contexts=[
                context.strip()
                for context in row.contexts.split(",")
                if context.strip()
            ],
        )
        for row in rows
    ]


@router.get("/api/me/groups", response_model=list[GroupRead])
async def my_groups(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_session)],
) -> list[GroupRead]:
    bookmarks = list(
        (
            await db.scalars(
                select(UserGroupBookmark)
                .options(selectinload(UserGroupBookmark.group))
                .where(UserGroupBookmark.user_id == user.id)
                .order_by(UserGroupBookmark.is_primary.desc(), UserGroupBookmark.created_at)
            )
        ).all()
    )
    return [
        GroupRead(
            id=row.group.id,
            code=row.group.code,
            academic_year=row.group.academic_year,
            is_primary=row.is_primary,
        )
        for row in bookmarks
    ]


@router.post("/api/me/groups", response_model=GroupRead)
async def save_group(
    payload: BookmarkCreate,
    session: Annotated[UserSession, Depends(require_csrf)],
    db: Annotated[AsyncSession, Depends(get_session)],
) -> GroupRead:
    group = await db.get(StudentGroup, payload.group_id)
    if group is None or not group.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Group not found")

    existing = await db.get(
        UserGroupBookmark,
        {"user_id": session.user_id, "group_id": group.id},
    )
    make_primary = payload.is_primary or existing is None and not await db.scalar(
        select(UserGroupBookmark.user_id).where(
            UserGroupBookmark.user_id == session.user_id
        )
    )
    if make_primary:
        await db.execute(
            update(UserGroupBookmark)
            .where(UserGroupBookmark.user_id == session.user_id)
            .values(is_primary=False)
        )
    if existing:
        existing.is_primary = make_primary or existing.is_primary
    else:
        db.add(
            UserGroupBookmark(
                user_id=session.user_id,
                group_id=group.id,
                is_primary=make_primary,
            )
        )
    await db.commit()
    return GroupRead(
        id=group.id,
        code=group.code,
        academic_year=group.academic_year,
        is_primary=make_primary,
    )


@router.delete("/api/me/groups/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_group(
    group_id: str,
    session: Annotated[UserSession, Depends(require_csrf)],
    db: Annotated[AsyncSession, Depends(get_session)],
) -> None:
    bookmark = await db.get(
        UserGroupBookmark,
        {"user_id": session.user_id, "group_id": group_id},
    )
    if bookmark is None:
        return
    was_primary = bookmark.is_primary
    await db.execute(
        delete(UserGroupBookmark).where(
            UserGroupBookmark.user_id == session.user_id,
            UserGroupBookmark.group_id == group_id,
        )
    )
    if was_primary:
        next_bookmark = await db.scalar(
            select(UserGroupBookmark)
            .where(UserGroupBookmark.user_id == session.user_id)
            .order_by(UserGroupBookmark.created_at)
            .limit(1)
        )
        if next_bookmark:
            next_bookmark.is_primary = True
    await db.commit()
