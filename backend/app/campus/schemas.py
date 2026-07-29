from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, HttpUrl


class RoomRead(BaseModel):
    id: str
    room_number: str
    title: str
    floor: str
    directions: str
    verified_at: datetime | None


class BuildingRead(BaseModel):
    id: str
    slug: str
    name: str
    short_name: str
    kind: str
    building_number: str
    address: str
    entrance_hint: str
    aliases: list[str]
    complex_slug: str
    dgis_url: HttpUrl
    dgis_object_id: str
    dgis_complex_id: str | None
    source_url: HttpUrl | None
    latitude: float | None
    longitude: float | None
    sort_order: int
    verified_at: datetime | None
    rooms: list[RoomRead]
