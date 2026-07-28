from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class DictionaryItem(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    value: str
    kind: int = Field(alias="SORT")


class RawScheduleLesson(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    date_value: str = Field(alias="DATE_Z")
    time_value: str = Field(alias="TIME_Z")
    subject: str = Field(alias="DISCIP")
    lesson_type: str = Field(default="", alias="KOW")
    css_class: str = Field(default="", alias="CLASS")
    room: str = Field(default="", alias="AUD")
    teacher: str = Field(default="", alias="PREP")


class ScheduleLesson(BaseModel):
    date: date
    time: str
    subject: str
    lesson_type: str
    room: str
    teacher: str


class ScheduleRead(BaseModel):
    group_code: str
    lessons: list[ScheduleLesson]
    fetched_at: datetime
    is_stale: bool
    source_url: str


class CalendarPeriod(BaseModel):
    starts_on: date
    ends_on: date
    title: str


class GroupCodeCreate(BaseModel):
    code: str = Field(min_length=1, max_length=80)
    is_primary: bool = True

