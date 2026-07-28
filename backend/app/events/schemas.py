from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class EventOccurrenceRead(BaseModel):
    occurrence_id: str
    event_id: str | None
    series_id: str | None
    title: str
    description: str
    event_type: str
    starts_at: datetime
    ends_at: datetime
    all_day: bool
    location: str
    organizer: str
    external_url: str | None
    status: Literal["scheduled", "moved", "cancelled", "completed"]
    is_confirmed: bool


class EventSubscriptionCreate(BaseModel):
    event_id: str | None = Field(default=None, max_length=36)
    series_id: str | None = Field(default=None, max_length=36)
    occurrence_start: datetime | None = None

