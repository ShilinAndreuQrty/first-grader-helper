from __future__ import annotations

from pydantic import BaseModel, Field


class OnboardingStepRead(BaseModel):
    id: str
    slug: str
    title: str
    description: str
    action_path: str
    sort_order: int
    completed: bool


class ProgressUpdate(BaseModel):
    completed: bool


class IssueCreate(BaseModel):
    context: str = Field(min_length=2, max_length=100)
    message: str = Field(min_length=5, max_length=2000)


class FaqFeedbackCreate(BaseModel):
    is_helpful: bool
    comment: str = Field(default="", max_length=1000)

