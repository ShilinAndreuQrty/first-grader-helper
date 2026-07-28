from __future__ import annotations

import json
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, require_csrf
from app.db import get_session
from app.models import (
    NotificationDelivery,
    NotificationJob,
    NotificationPreference,
    User,
    UserSession,
)
from app.notifications.schemas import (
    InAppReminderRead,
    NotificationPreferencesRead,
    NotificationPreferencesUpdate,
)

router = APIRouter(prefix="/api/me", tags=["notifications"])


def preference_read(preference: NotificationPreference) -> NotificationPreferencesRead:
    return NotificationPreferencesRead(
        union_meetings=bool(preference.union_meetings),
        selected_events=bool(preference.selected_events),
        announcements=bool(preference.announcements),
        minutes_before=preference.minutes_before or 60,
        in_app_enabled=preference.in_app_enabled is not False,
        vk_notifications_enabled=bool(preference.vk_notifications_enabled),
        community_messages_enabled=bool(preference.community_messages_enabled),
    )


@router.get(
    "/notification-preferences",
    response_model=NotificationPreferencesRead,
)
async def get_preferences(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_session)],
) -> NotificationPreferencesRead:
    preference = await db.get(NotificationPreference, user.id)
    if preference is None:
        preference = NotificationPreference(user_id=user.id)
        db.add(preference)
        await db.commit()
    return preference_read(preference)


@router.put(
    "/notification-preferences",
    response_model=NotificationPreferencesRead,
)
async def update_preferences(
    payload: NotificationPreferencesUpdate,
    session: Annotated[UserSession, Depends(require_csrf)],
    db: Annotated[AsyncSession, Depends(get_session)],
) -> NotificationPreferencesRead:
    preference = await db.get(NotificationPreference, session.user_id)
    if preference is None:
        preference = NotificationPreference(user_id=session.user_id)
        db.add(preference)
    for key, value in payload.model_dump().items():
        setattr(preference, key, value)
    await db.commit()
    return preference_read(preference)


@router.get("/reminders", response_model=list[InAppReminderRead])
async def in_app_reminders(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_session)],
) -> list[InAppReminderRead]:
    rows = (
        await db.execute(
            select(NotificationJob, NotificationDelivery)
            .join(NotificationDelivery)
            .where(
                NotificationJob.user_id == user.id,
                NotificationJob.channel == "in_app",
                NotificationDelivery.status == "delivered",
            )
            .order_by(NotificationDelivery.delivered_at.desc())
            .limit(50)
        )
    ).all()
    result: list[InAppReminderRead] = []
    for job, delivery in rows:
        payload = json.loads(job.payload_json)
        result.append(
            InAppReminderRead(
                id=delivery.id,
                title=payload.get("title", "Напоминание"),
                body=payload.get("body", ""),
                delivered_at=delivery.delivered_at,
            )
        )
    return result

