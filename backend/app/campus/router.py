from __future__ import annotations

import json
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.campus.schemas import BuildingRead, RoomRead
from app.campus.service import alias_matches_location, normalize_campus_query
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
        .order_by(CampusBuilding.sort_order, CampusBuilding.short_name)
    )
    result: list[BuildingRead] = []
    for building in (await db.scalars(statement)).all():
        aliases = json.loads(building.aliases)
        room_statement = select(CampusRoom).where(
            CampusRoom.building_id == building.id,
            CampusRoom.status == "published",
            CampusRoom.deleted_at.is_(None),
        )
        rooms = list((await db.scalars(room_statement)).all())
        if query:
            normalized_query = normalize_campus_query(query)
            building_text = normalize_campus_query(
                " ".join(
                    (
                        building.name,
                        building.short_name,
                        building.building_number,
                        building.address,
                    )
                )
            )
            matching_rooms = [
                room
                for room in rooms
                if normalized_query
                in normalize_campus_query(
                    f"{room.room_number} {room.title} {room.directions}"
                )
            ]
            matches_alias = any(
                alias_matches_location(query, alias) for alias in aliases
            )
            if normalized_query not in building_text and not matching_rooms and not matches_alias:
                continue
        result.append(
            BuildingRead(
                id=building.id,
                slug=building.slug,
                name=building.name,
                short_name=building.short_name,
                kind=building.kind,
                building_number=building.building_number,
                address=building.address,
                entrance_hint=building.entrance_hint,
                aliases=aliases,
                complex_slug=building.complex_slug,
                dgis_url=building.dgis_url,
                dgis_object_id=building.dgis_object_id,
                dgis_complex_id=building.dgis_complex_id,
                source_url=building.source_url or None,
                latitude=float(building.latitude) if building.latitude else None,
                longitude=float(building.longitude) if building.longitude else None,
                sort_order=building.sort_order,
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
