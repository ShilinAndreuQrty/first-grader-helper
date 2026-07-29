from __future__ import annotations

import asyncio
import json
from datetime import UTC, datetime
from typing import TypedDict

from sqlalchemy import select

from app.db import SessionFactory
from app.models import CampusBuilding, CampusRoom

CHECKED_AT = datetime(2026, 7, 29, tzinfo=UTC)


class BuildingSeed(TypedDict):
    slug: str
    name: str
    short_name: str
    building_number: str
    address: str
    entrance_hint: str
    aliases: list[str]
    complex_slug: str
    dgis_url: str
    dgis_object_id: str
    source_url: str
    latitude: str | None
    longitude: str | None
    sort_order: int


# Every row is backed by both the official Tulsu campus page and a direct
# public 2GIS object page. Missing coordinates stay null instead of being
# reconstructed from screenshots or undocumented endpoints.
BUILDINGS: list[BuildingSeed] = [
    {
        "slug": "main",
        "name": "Главный корпус ТулГУ",
        "short_name": "Главный корпус",
        "building_number": "Главный",
        "address": "Тула, проспект Ленина, 92",
        "entrance_hint": "Главный и 9-й корпуса соединены. Вход в главный корпус — через 9-й.",
        "aliases": ["гл", "гл. к.", "главный", "главный корпус"],
        "complex_slug": "main-9",
        "dgis_url": "https://2gis.ru/tula/geo/5067185235966202",
        "dgis_object_id": "5067185235966202",
        "source_url": "https://tulsu.ru/facilities/academic-building/4",
        "latitude": "54.166259",
        "longitude": "37.586635",
        "sort_order": 0,
    },
    {
        "slug": "building-1",
        "name": "Учебный корпус №1 ТулГУ",
        "short_name": "Корпус №1",
        "building_number": "1",
        "address": "Тула, проспект Ленина, 95",
        "entrance_hint": "",
        "aliases": ["1", "1к", "1 корпус", "корпус 1"],
        "complex_slug": "",
        "dgis_url": "https://2gis.ru/tula/firm/5067533128372221",
        "dgis_object_id": "5067533128372221",
        "source_url": "https://tulsu.ru/facilities/academic-building/2",
        "latitude": None,
        "longitude": None,
        "sort_order": 1,
    },
    {
        "slug": "building-2",
        "name": "Учебный корпус №2 ТулГУ",
        "short_name": "Корпус №2",
        "building_number": "2",
        "address": "Тула, проспект Ленина, 84",
        "entrance_hint": "",
        "aliases": ["2", "2к", "2 корпус", "корпус 2"],
        "complex_slug": "",
        "dgis_url": "https://2gis.ru/tula/geo/70030076867233638",
        "dgis_object_id": "70030076867233638",
        "source_url": "https://tulsu.ru/facilities/academic-building/9",
        "latitude": "54.172682",
        "longitude": "37.594327",
        "sort_order": 2,
    },
    {
        "slug": "building-3",
        "name": "Учебный корпус №3 ТулГУ",
        "short_name": "Корпус №3",
        "building_number": "3",
        "address": "Тула, проспект Ленина, 84, корпус 8",
        "entrance_hint": "",
        "aliases": ["3", "3к", "3 корпус", "корпус 3"],
        "complex_slug": "",
        "dgis_url": "https://2gis.ru/tula/firm/70000001096985234",
        "dgis_object_id": "70000001096985234",
        "source_url": "https://tulsu.ru/facilities/academic-building/10",
        "latitude": None,
        "longitude": None,
        "sort_order": 3,
    },
    {
        "slug": "building-5",
        "name": "Учебный корпус №5 ТулГУ",
        "short_name": "Корпус №5",
        "building_number": "5",
        "address": "Тула, улица Фридриха Энгельса, 155",
        "entrance_hint": "",
        "aliases": ["5", "5к", "5 корпус", "корпус 5"],
        "complex_slug": "",
        "dgis_url": "https://2gis.ru/tula/firm/5067533128372217",
        "dgis_object_id": "5067533128372217",
        "source_url": "https://tulsu.ru/facilities/academic-building/12",
        "latitude": None,
        "longitude": None,
        "sort_order": 5,
    },
    {
        "slug": "building-6",
        "name": "Учебный корпус №6 ТулГУ",
        "short_name": "Корпус №6",
        "building_number": "6",
        "address": "Тула, проспект Ленина, 90",
        "entrance_hint": "",
        "aliases": ["6", "6к", "6 корпус", "корпус 6"],
        "complex_slug": "",
        "dgis_url": "https://2gis.ru/tula/firm/5067533128433198",
        "dgis_object_id": "5067533128433198",
        "source_url": "https://tulsu.ru/facilities/academic-building/13",
        "latitude": None,
        "longitude": None,
        "sort_order": 6,
    },
    {
        "slug": "building-8",
        "name": "Учебный корпус №8 ТулГУ",
        "short_name": "Корпус №8",
        "building_number": "8",
        "address": "Тула, улица Болдина, 153",
        "entrance_hint": "",
        "aliases": ["8", "8к", "8 корпус", "корпус 8"],
        "complex_slug": "",
        "dgis_url": "https://2gis.ru/tula/firm/70000001067025114",
        "dgis_object_id": "70000001067025114",
        "source_url": "https://tulsu.ru/facilities/academic-building/16",
        "latitude": None,
        "longitude": None,
        "sort_order": 8,
    },
    {
        "slug": "building-9",
        "name": "Учебный корпус №9 ТулГУ",
        "short_name": "Корпус №9",
        "building_number": "9",
        "address": "Тула, проспект Ленина, 92",
        "entrance_hint": (
            "Общий вход соединённого комплекса главного и 9-го корпусов "
            "находится здесь."
        ),
        "aliases": ["9", "9к", "9 корпус", "корпус 9"],
        "complex_slug": "main-9",
        "dgis_url": "https://2gis.ru/tula/geo/5067185235966202",
        "dgis_object_id": "5067185235966202",
        "source_url": "https://tulsu.ru/facilities/academic-building/8",
        "latitude": "54.166259",
        "longitude": "37.586635",
        "sort_order": 9,
    },
    {
        "slug": "building-10",
        "name": "Учебный корпус №10 ТулГУ",
        "short_name": "Корпус №10",
        "building_number": "10",
        "address": "Тула, улица Болдина, 128",
        "entrance_hint": "",
        "aliases": ["10", "10к", "10 корпус", "корпус 10"],
        "complex_slug": "",
        "dgis_url": "https://2gis.ru/tula/firm/5067533128372227",
        "dgis_object_id": "5067533128372227",
        "source_url": "https://tulsu.ru/facilities/academic-building/17",
        "latitude": "54.167529",
        "longitude": "37.585494",
        "sort_order": 10,
    },
    {
        "slug": "building-11",
        "name": "Учебный корпус №11 ТулГУ",
        "short_name": "Корпус №11",
        "building_number": "11",
        "address": "Тула, улица Болдина, 151",
        "entrance_hint": "",
        "aliases": ["11", "11к", "11 корпус", "корпус 11"],
        "complex_slug": "",
        "dgis_url": "https://2gis.ru/tula/firm/5067533128433192",
        "dgis_object_id": "5067533128433192",
        "source_url": "https://tulsu.ru/facilities/academic-building/3",
        "latitude": None,
        "longitude": None,
        "sort_order": 11,
    },
    {
        "slug": "building-12",
        "name": "Учебный корпус №12 ТулГУ",
        "short_name": "Корпус №12",
        "building_number": "12",
        "address": "Тула, улица Агеева, 1Б",
        "entrance_hint": "",
        "aliases": ["12", "12к", "12 корпус", "корпус 12"],
        "complex_slug": "",
        "dgis_url": "https://2gis.ru/tula/firm/5067077861790182",
        "dgis_object_id": "5067077861790182",
        "source_url": "https://tulsu.ru/facilities/academic-building/18",
        "latitude": "54.174237",
        "longitude": "37.593557",
        "sort_order": 12,
    },
    {
        "slug": "laboratory-6",
        "name": "Лабораторный корпус №6 ТулГУ",
        "short_name": "Лабораторный №6",
        "building_number": "Лаб. 6",
        "address": "Тула, улица Смидович, 3А",
        "entrance_hint": "",
        "aliases": ["лаб", "лаб 6", "лб", "лабораторный", "лабораторный корпус 6"],
        "complex_slug": "",
        "dgis_url": "https://2gis.ru/tula/geo/5067185235967331",
        "dgis_object_id": "5067185235967331",
        "source_url": "https://tulsu.ru/facilities/academic-building/14",
        "latitude": None,
        "longitude": None,
        "sort_order": 20,
    },
]


async def seed_campus() -> dict[str, int]:
    changed = {"buildings": 0, "rooms": 0}
    async with SessionFactory() as db:
        for data in BUILDINGS:
            building = await db.scalar(
                select(CampusBuilding).where(
                    (CampusBuilding.slug == data["slug"])
                    | (CampusBuilding.short_name == data["short_name"])
                )
            )
            if building is None and data["slug"] == "main":
                building = await db.scalar(
                    select(CampusBuilding).where(
                        CampusBuilding.short_name == "Главный"
                    )
                )
            if building is None:
                building = CampusBuilding()
                db.add(building)
                changed["buildings"] += 1
            for field, value in data.items():
                setattr(
                    building,
                    field,
                    json.dumps(value, ensure_ascii=False)
                    if field == "aliases"
                    else value,
                )
            building.dgis_complex_id = None
            building.status = "published"
            building.verified_at = CHECKED_AT
            building.deleted_at = None
            await db.flush()

            if data["slug"] == "main":
                room = await db.scalar(
                    select(CampusRoom).where(
                        CampusRoom.building_id == building.id,
                        CampusRoom.room_number == "425",
                    )
                )
                if room is None:
                    room = CampusRoom(
                        building_id=building.id,
                        room_number="425",
                    )
                    db.add(room)
                    changed["rooms"] += 1
                room.title = "Дирекция ИПМКН"
                room.floor = "4"
                room.directions = (
                    "Кабинет подтверждён официальной страницей ИПМКН."
                )
                room.status = "published"
                room.verified_at = CHECKED_AT
                room.deleted_at = None
        await db.commit()
    return changed


if __name__ == "__main__":
    print(asyncio.run(seed_campus()))
