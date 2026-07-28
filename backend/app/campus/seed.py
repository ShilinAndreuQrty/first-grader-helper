from __future__ import annotations

import asyncio
from datetime import UTC, datetime

from sqlalchemy import select

from app.db import SessionFactory
from app.models import CampusBuilding, CampusRoom


async def seed_campus() -> dict[str, int]:
    created = {"buildings": 0, "rooms": 0}
    async with SessionFactory() as db:
        main = await db.scalar(
            select(CampusBuilding).where(CampusBuilding.short_name == "Главный")
        )
        if main is None:
            main = CampusBuilding(
                name="Главный учебный корпус ТулГУ",
                short_name="Главный",
                address="Тула, проспект Ленина, 92",
                entrance_hint="Сверяйтесь с вывесками корпусов на территории.",
                dgis_url="https://2gis.ru/tula/geo/5067185235966202",
                status="published",
                verified_at=datetime(2026, 7, 29, tzinfo=UTC),
            )
            db.add(main)
            await db.flush()
            created["buildings"] += 1

        rooms = [
            (
                "425",
                "Дирекция ИПМКН",
                "4",
                "Адрес и кабинет подтверждены официальной страницей ИПМКН.",
                "published",
            ),
            ("403", "Профсоюзное собрание", "4", "Требует проверки.", "needs_review"),
            ("123", "Профком", "1", "Требует проверки.", "needs_review"),
            ("125", "Профком", "1", "Требует проверки.", "needs_review"),
        ]
        for number, title, floor, directions, room_status in rooms:
            exists = await db.scalar(
                select(CampusRoom).where(
                    CampusRoom.building_id == main.id,
                    CampusRoom.room_number == number,
                )
            )
            if exists is None:
                db.add(
                    CampusRoom(
                        building_id=main.id,
                        room_number=number,
                        title=title,
                        floor=floor,
                        directions=directions,
                        status=room_status,
                        verified_at=(
                            datetime(2026, 7, 29, tzinfo=UTC)
                            if room_status == "published"
                            else None
                        ),
                    )
                )
                created["rooms"] += 1
        await db.commit()
    return created


if __name__ == "__main__":
    print(asyncio.run(seed_campus()))

