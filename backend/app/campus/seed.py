from __future__ import annotations

import asyncio
import json
from datetime import UTC, datetime
from typing import NotRequired, TypedDict

from sqlalchemy import select

from app.db import SessionFactory
from app.models import CampusBuilding, CampusRoom

CHECKED_AT = datetime(2026, 9, 1, tzinfo=UTC)


class BuildingSeed(TypedDict):
    slug: str
    name: str
    short_name: str
    kind: NotRequired[str]
    building_number: str
    address: str
    entrance_hint: str
    aliases: list[str]
    complex_slug: str
    dgis_url: str
    dgis_object_id: str
    dgis_complex_id: str | None
    source_url: str
    latitude: str | None
    longitude: str | None
    sort_order: int


class RoomSeed(TypedDict):
    room_number: str
    title: str
    floor: str
    directions: str


# Every row is backed by both the official Tulsu campus page and a direct
# public 2GIS object page. Coordinates come from the visible route links in
# those 2GIS cards.
BUILDINGS: list[BuildingSeed] = [
    {
        "slug": "main",
        "name": "Главный корпус ТулГУ",
        "short_name": "Главный корпус",
        "building_number": "Главный",
        "address": "Тула, проспект Ленина, 92",
        "entrance_hint": "Главный и 9-й корпуса — одно здание, вход с улицы Смидович.",
        "aliases": ["гл", "гл. к.", "главный", "главный корпус"],
        "complex_slug": "main-9",
        "dgis_url": "https://2gis.ru/tula/geo/5067185235966202",
        "dgis_object_id": "5067185235966202",
        "dgis_complex_id": "5067185235966202",
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
        "dgis_complex_id": None,
        "source_url": "https://tulsu.ru/facilities/academic-building/2",
        "latitude": "54.172968",
        "longitude": "37.596290",
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
        "dgis_complex_id": None,
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
        "dgis_complex_id": "70000001096985234",
        "source_url": "https://tulsu.ru/facilities/academic-building/10",
        "latitude": "54.171589",
        "longitude": "37.589311",
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
        "dgis_complex_id": "5067533128372217",
        "source_url": "https://tulsu.ru/facilities/academic-building/12",
        "latitude": "54.173325",
        "longitude": "37.591994",
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
        "dgis_complex_id": "5067533128433198",
        "source_url": "https://tulsu.ru/facilities/academic-building/13",
        "latitude": "54.167928",
        "longitude": "37.588873",
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
        "dgis_complex_id": None,
        "source_url": "https://tulsu.ru/facilities/academic-building/16",
        "latitude": "54.167518",
        "longitude": "37.588360",
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
        "dgis_complex_id": "5067185235966202",
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
        "dgis_complex_id": "5067533128372227",
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
        "dgis_complex_id": None,
        "source_url": "https://tulsu.ru/facilities/academic-building/3",
        "latitude": "54.167809",
        "longitude": "37.586927",
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
        "dgis_complex_id": "5067077861790182",
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
        "dgis_complex_id": None,
        "source_url": "https://tulsu.ru/facilities/academic-building/14",
        "latitude": "54.168529",
        "longitude": "37.587819",
        "sort_order": 20,
    },
]

ROOMS_BY_BUILDING: dict[str, tuple[RoomSeed, ...]] = {
    "main": (
        {
            "room_number": "425",
            "title": "Дирекция ИПМКН",
            "floor": "4",
            "directions": "",
        },
        {
            "room_number": "123",
            "title": "Профком",
            "floor": "1",
            "directions": "",
        },
        {
            "room_number": "125",
            "title": "Профком",
            "floor": "1",
            "directions": "",
        },
        {
            "room_number": "111",
            "title": "Отдел стипендий",
            "floor": "1",
            "directions": "",
        },
        {
            "room_number": "124",
            "title": "Архив",
            "floor": "1",
            "directions": "",
        },
        {
            "room_number": "133",
            "title": "Библиотека",
            "floor": "1",
            "directions": "",
        },
        {
            "room_number": "133а",
            "title": "Студенческое пространство",
            "floor": "1",
            "directions": "",
        },
        {
            "room_number": "001",
            "title": "Студенческий офис",
            "floor": "0",
            "directions": "Переход между 9-м и главным корпусами",
        },
        {
            "room_number": "229",
            "title": "Отдел кадров",
            "floor": "2",
            "directions": "Направо — сектор студентов",
        },
    ),
    "building-9": (
        {
            "room_number": "4",
            "title": "Фойе актового зала",
            "floor": "4",
            "directions": "",
        },
    ),
}

DORMITORIES: list[BuildingSeed] = [
    {
        "slug": "dormitory-1",
        "name": "Общежитие №1 ТулГУ",
        "short_name": "Общежитие №1",
        "kind": "dormitory",
        "building_number": "1",
        "address": "Тула, улица Смидович, 10а",
        "entrance_hint": "",
        "aliases": ["общежитие 1", "общ 1", "общ. 1"],
        "complex_slug": "",
        "dgis_url": "https://2gis.ru/tula/firm/5067077861991673",
        "dgis_object_id": "5067077861991673",
        "dgis_complex_id": None,
        "source_url": "https://tulsu.ru/facilities/dormitory",
        "latitude": "54.167264",
        "longitude": "37.584782",
        "sort_order": 101,
    },
    {
        "slug": "dormitory-2",
        "name": "Общежитие №2 ТулГУ",
        "short_name": "Общежитие №2",
        "kind": "dormitory",
        "building_number": "2",
        "address": "Тула, улица Смидович, 12",
        "entrance_hint": "",
        "aliases": ["общежитие 2", "общ 2", "общ. 2"],
        "complex_slug": "",
        "dgis_url": "https://2gis.ru/tula/firm/5067077861991674",
        "dgis_object_id": "5067077861991674",
        "dgis_complex_id": None,
        "source_url": "https://tulsu.ru/facilities/dormitory",
        "latitude": "54.166505",
        "longitude": "37.584374",
        "sort_order": 102,
    },
    {
        "slug": "dormitory-3",
        "name": "Общежитие №3 ТулГУ",
        "short_name": "Общежитие №3",
        "kind": "dormitory",
        "building_number": "3",
        "address": "Тула, улица 9 Мая, 8",
        "entrance_hint": "",
        "aliases": ["общежитие 3", "общ 3", "общ. 3"],
        "complex_slug": "",
        "dgis_url": "https://2gis.ru/tula/firm/5067077861991675",
        "dgis_object_id": "5067077861991675",
        "dgis_complex_id": None,
        "source_url": "https://tulsu.ru/facilities/dormitory",
        "latitude": "54.165961",
        "longitude": "37.581956",
        "sort_order": 103,
    },
    {
        "slug": "dormitory-4-1",
        "name": "Общежитие №4/1 ТулГУ",
        "short_name": "Общежитие №4/1",
        "kind": "dormitory",
        "building_number": "4/1",
        "address": "Тула, Оружейная улица, 15, корпус 1",
        "entrance_hint": "",
        "aliases": ["общежитие 4/1", "общ 4/1", "общ. 4/1"],
        "complex_slug": "",
        "dgis_url": "https://2gis.ru/tula/firm/5067077861991676",
        "dgis_object_id": "5067077861991676",
        "dgis_complex_id": None,
        "source_url": "https://tulsu.ru/facilities/dormitory",
        "latitude": "54.168295",
        "longitude": "37.582621",
        "sort_order": 104,
    },
    {
        "slug": "dormitory-4-2",
        "name": "Общежитие №4/2 ТулГУ",
        "short_name": "Общежитие №4/2",
        "kind": "dormitory",
        "building_number": "4/2",
        "address": "Тула, Оружейная улица, 15, корпус 2",
        "entrance_hint": "",
        "aliases": ["общежитие 4/2", "общ 4/2", "общ. 4/2"],
        "complex_slug": "",
        "dgis_url": "https://2gis.ru/tula/firm/5067078861963050",
        "dgis_object_id": "5067078861963050",
        "dgis_complex_id": None,
        "source_url": "https://tulsu.ru/facilities/dormitory",
        "latitude": "54.167782",
        "longitude": "37.582113",
        "sort_order": 105,
    },
    {
        "slug": "dormitory-6-1",
        "name": "Общежитие №6/1 ТулГУ",
        "short_name": "Общежитие №6/1",
        "kind": "dormitory",
        "building_number": "6/1",
        "address": "Тула, улица Фридриха Энгельса, 159, корпус 1",
        "entrance_hint": "",
        "aliases": ["общежитие 6/1", "общ 6/1", "общ. 6/1"],
        "complex_slug": "",
        "dgis_url": "https://2gis.ru/tula/firm/5067077861991678",
        "dgis_object_id": "5067077861991678",
        "dgis_complex_id": None,
        "source_url": "https://tulsu.ru/facilities/dormitory",
        "latitude": "54.174110",
        "longitude": "37.589888",
        "sort_order": 106,
    },
    {
        "slug": "dormitory-6-2",
        "name": "Общежитие №6/2 ТулГУ",
        "short_name": "Общежитие №6/2",
        "kind": "dormitory",
        "building_number": "6/2",
        "address": "Тула, улица Фридриха Энгельса, 159, корпус 2",
        "entrance_hint": "",
        "aliases": ["общежитие 6/2", "общ 6/2", "общ. 6/2"],
        "complex_slug": "",
        "dgis_url": "https://2gis.ru/tula/firm/5067077861991679",
        "dgis_object_id": "5067077861991679",
        "dgis_complex_id": None,
        "source_url": "https://tulsu.ru/facilities/dormitory",
        "latitude": "54.173927",
        "longitude": "37.590734",
        "sort_order": 107,
    },
    {
        "slug": "dormitory-7",
        "name": "Общежитие №7 ТулГУ",
        "short_name": "Общежитие №7",
        "kind": "dormitory",
        "building_number": "7",
        "address": "Тула, Оружейная улица, 1б",
        "entrance_hint": "",
        "aliases": ["общежитие 7", "общ 7", "общ. 7"],
        "complex_slug": "",
        "dgis_url": "https://2gis.ru/tula/firm/5067077861991680",
        "dgis_object_id": "5067077861991680",
        "dgis_complex_id": None,
        "source_url": "https://tulsu.ru/facilities/dormitory",
        "latitude": "54.173137",
        "longitude": "37.587803",
        "sort_order": 108,
    },
    {
        "slug": "dormitory-8",
        "name": "Общежитие №8 ТулГУ",
        "short_name": "Общежитие №8",
        "kind": "dormitory",
        "building_number": "8",
        "address": "Тула, улица Фридриха Энгельса, 153",
        "entrance_hint": "",
        "aliases": ["общежитие 8", "общ 8", "общ. 8"],
        "complex_slug": "",
        "dgis_url": "https://2gis.ru/tula/firm/5067077861991681",
        "dgis_object_id": "5067077861991681",
        "dgis_complex_id": None,
        "source_url": "https://tulsu.ru/facilities/dormitory",
        "latitude": "54.174095",
        "longitude": "37.592245",
        "sort_order": 109,
    },
    {
        "slug": "dormitory-9",
        "name": "Общежитие №9 ТулГУ",
        "short_name": "Общежитие №9",
        "kind": "dormitory",
        "building_number": "9",
        "address": "Тула, улица Фридриха Энгельса, 52",
        "entrance_hint": "",
        "aliases": ["общежитие 9", "общ 9", "общ. 9"],
        "complex_slug": "",
        "dgis_url": "https://2gis.ru/tula/firm/5067077861991475",
        "dgis_object_id": "5067077861991475",
        "dgis_complex_id": None,
        "source_url": "https://tulsu.ru/facilities/dormitory",
        "latitude": "54.183876",
        "longitude": "37.602668",
        "sort_order": 110,
    },
    {
        "slug": "dormitory-10",
        "name": "Общежитие №10 ТулГУ",
        "short_name": "Общежитие №10",
        "kind": "dormitory",
        "building_number": "10",
        "address": "Тула, улица Вересаева, 7",
        "entrance_hint": "",
        "aliases": ["общежитие 10", "общ 10", "общ. 10"],
        "complex_slug": "",
        "dgis_url": "https://2gis.ru/tula/firm/5067077861770904",
        "dgis_object_id": "5067077861770904",
        "dgis_complex_id": None,
        "source_url": "https://tulsu.ru/facilities/dormitory",
        "latitude": "54.192069",
        "longitude": "37.589178",
        "sort_order": 111,
    },
    {
        "slug": "dormitory-11",
        "name": "Общежитие №11 ТулГУ",
        "short_name": "Общежитие №11",
        "kind": "dormitory",
        "building_number": "11",
        "address": "Тула, улица Революции, 47",
        "entrance_hint": "",
        "aliases": ["общежитие 11", "общ 11", "общ. 11"],
        "complex_slug": "",
        "dgis_url": "https://2gis.ru/tula/firm/5067077861770924",
        "dgis_object_id": "5067077861770924",
        "dgis_complex_id": None,
        "source_url": "https://tulsu.ru/facilities/dormitory",
        "latitude": "54.191841",
        "longitude": "37.586727",
        "sort_order": 112,
    },
]


async def seed_campus() -> dict[str, int]:
    changed = {"buildings": 0, "rooms": 0}
    async with SessionFactory() as db:
        for data in [*BUILDINGS, *DORMITORIES]:
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
            building.kind = data.get("kind", "academic")
            for field, value in data.items():
                setattr(
                    building,
                    field,
                    json.dumps(value, ensure_ascii=False)
                    if field == "aliases"
                    else value,
                )
            building.status = "published"
            building.verified_at = CHECKED_AT
            building.deleted_at = None
            await db.flush()

            for room_data in ROOMS_BY_BUILDING.get(data["slug"], ()):
                room_number = room_data["room_number"]
                title = room_data["title"]
                floor = room_data["floor"]
                directions = room_data["directions"]
                room = await db.scalar(
                    select(CampusRoom).where(
                        CampusRoom.building_id == building.id,
                        CampusRoom.room_number == room_number,
                    )
                )
                if room is None:
                    room = CampusRoom(
                        building_id=building.id,
                        room_number=room_number,
                    )
                    db.add(room)
                    changed["rooms"] += 1
                room.title = title
                room.floor = floor
                room.directions = directions
                room.status = "published"
                room.verified_at = CHECKED_AT
                room.deleted_at = None
        await db.commit()
    return changed


if __name__ == "__main__":
    print(asyncio.run(seed_campus()))
