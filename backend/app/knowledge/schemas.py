from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class CategoryRead(BaseModel):
    id: str
    title: str
    count: int


class FaqRead(BaseModel):
    id: str
    question: str
    answer_markdown: str
    category: str
    source_url: str | None
    verified_at: datetime | None
    is_time_sensitive: bool


class AssistantQuery(BaseModel):
    text: str = Field(min_length=2, max_length=500)
    session_id: str | None = Field(default=None, max_length=80)
    selected_faq_id: str | None = Field(default=None, max_length=36)


class AssistantSuggestion(BaseModel):
    faq_id: str
    question: str
    category: str


class AssistantSource(BaseModel):
    title: str
    url: str | None = None


class AssistantResponse(BaseModel):
    type: Literal["answer", "suggestions", "clarification", "not_found"]
    answer: FaqRead | None = None
    faq_ids: list[str]
    suggestions: list[AssistantSuggestion]
    confidence: Literal["high", "medium", "low"]
    sources: list[AssistantSource]
    verified_at: datetime | None = None
