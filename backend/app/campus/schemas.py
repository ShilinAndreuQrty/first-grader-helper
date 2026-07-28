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
    name: str
    short_name: str
    address: str
    entrance_hint: str
    dgis_url: HttpUrl
    latitude: float | None
    longitude: float | None
    verified_at: datetime | None
    rooms: list[RoomRead]

