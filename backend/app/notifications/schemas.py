from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class NotificationPreferencesRead(BaseModel):
    union_meetings: bool
    selected_events: bool
    announcements: bool
    minutes_before: int
    in_app_enabled: bool
    vk_notifications_enabled: bool
    community_messages_enabled: bool


class NotificationPreferencesUpdate(NotificationPreferencesRead):
    minutes_before: int = Field(ge=5, le=10_080)


class InAppReminderRead(BaseModel):
    id: str
    title: str
    body: str
    delivered_at: datetime | None

