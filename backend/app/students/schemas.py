from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, HttpUrl


class GroupRead(BaseModel):
    id: str
    code: str
    academic_year: str
    is_primary: bool = False


class BookmarkCreate(BaseModel):
    group_id: str = Field(min_length=36, max_length=36)
    is_primary: bool = False


class TutorRead(BaseModel):
    id: str
    full_name: str
    vk_url: HttpUrl
    description: str
    photo_url: HttpUrl | None
    valid_until: datetime | None


class ResourceRead(BaseModel):
    id: str
    slug: str
    category: str
    category_slug: str
    title: str
    url: HttpUrl
    description: str
    icon: str
    source_kind: Literal["official", "student"]
    contexts: list[str]
