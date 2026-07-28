from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.campus.schemas import BuildingRead, RoomRead
from app.db import get_session
from app.models import CampusBuilding, CampusRoom

router = APIRouter(prefix="/api/campus", tags=["campus"])


@router.get("/buildings", response_model=list[BuildingRead])
async def buildings(
    db: Annotated[AsyncSession, Depends(get_session)],
    query: Annotated[str | None, Query(max_length=100)] = None,
) -> list[BuildingRead]:
    statement = (
        select(CampusBuilding)
        .where(
            CampusBuilding.status == "published",
            CampusBuilding.deleted_at.is_(None),
        )
        .order_by(CampusBuilding.short_name)
    )
    if query:
        pattern = f"%{query.strip()}%"
        statement = statement.where(
            or_(
                CampusBuilding.name.ilike(pattern),
                CampusBuilding.short_name.ilike(pattern),
                CampusBuilding.address.ilike(pattern),
            )
        )
    result: list[BuildingRead] = []
    for building in (await db.scalars(statement)).all():
        room_statement = select(CampusRoom).where(
            CampusRoom.building_id == building.id,
            CampusRoom.status == "published",
            CampusRoom.deleted_at.is_(None),
        )
        if query:
            pattern = f"%{query.strip()}%"
            room_statement = room_statement.where(
                or_(
                    CampusRoom.room_number.ilike(pattern),
                    CampusRoom.title.ilike(pattern),
                )
            )
        rooms = list((await db.scalars(room_statement)).all())
        result.append(
            BuildingRead(
                id=building.id,
                name=building.name,
                short_name=building.short_name,
                address=building.address,
                entrance_hint=building.entrance_hint,
                dgis_url=building.dgis_url,
                latitude=float(building.latitude) if building.latitude else None,
                longitude=float(building.longitude) if building.longitude else None,
                verified_at=building.verified_at,
                rooms=[
                    RoomRead(
                        id=room.id,
                        room_number=room.room_number,
                        title=room.title,
                        floor=room.floor,
                        directions=room.directions,
                        verified_at=room.verified_at,
                    )
                    for room in rooms
                ],
            )
        )
    return result

