from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, HttpUrl, model_validator

ContentStatus = Literal["draft", "needs_review", "published", "archived"]


class DashboardRead(BaseModel):
    needs_review_faq: int
    upcoming_events: int
    failed_assistant_queries: int
    unconfirmed_series: int
    recent_audit: int
    open_issue_reports: int


class FaqAdminRead(BaseModel):
    id: str
    question: str
    status: str
    version: int
    verified_at: datetime | None
    is_time_sensitive: bool


class FaqUpdate(BaseModel):
    question: str = Field(min_length=3, max_length=500)
    answer_markdown: str = Field(min_length=1, max_length=20_000)
    search_keywords: list[str] = Field(default_factory=list, max_length=30)
    source_url: HttpUrl | None = None
    status: ContentStatus
    is_time_sensitive: bool = False
    verified_at: datetime | None = None


class EventWrite(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    description: str = Field(default="", max_length=10_000)
    event_type: str = Field(default="other", min_length=2, max_length=60)
    starts_at: datetime
    ends_at: datetime
    location: str = Field(default="", max_length=300)
    organizer: str = Field(default="", max_length=200)
    external_url: HttpUrl | None = None
    status: ContentStatus = "draft"
    is_confirmed: bool = True

    @model_validator(mode="after")
    def validate_dates(self) -> EventWrite:
        if self.ends_at <= self.starts_at:
            raise ValueError("ends_at must be later than starts_at")
        return self


class ResourceWrite(BaseModel):
    category_id: str = Field(min_length=36, max_length=36)
    title: str = Field(min_length=2, max_length=200)
    url: HttpUrl
    description: str = Field(default="", max_length=500)
    icon: str = Field(default="link", max_length=80)
    sort_order: int = Field(default=0, ge=0, le=10_000)
    is_active: bool = True


class BuildingWrite(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    short_name: str = Field(min_length=1, max_length=80)
    address: str = Field(min_length=2, max_length=300)
    entrance_hint: str = Field(default="", max_length=500)
    dgis_url: HttpUrl
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    status: ContentStatus = "needs_review"


class AnnouncementWrite(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    body: str = Field(min_length=1, max_length=10_000)
    status: ContentStatus = "draft"
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    importance: Literal["normal", "important", "critical"] = "normal"


class OnboardingStepWrite(BaseModel):
    slug: str = Field(pattern=r"^[a-z0-9-]+$", max_length=100)
    title: str = Field(min_length=2, max_length=200)
    description: str = Field(default="", max_length=500)
    action_path: str = Field(default="", max_length=300)
    sort_order: int = Field(default=0, ge=0, le=1000)
    status: ContentStatus = "draft"
