from app.campus.schemas import BuildingRead
from app.campus.seed import BUILDINGS, DORMITORIES, ROOMS_BY_BUILDING
from app.campus.service import alias_matches_location


def test_building_catalog_allows_missing_coordinates() -> None:
    building = BuildingRead(
        id="building",
        slug="main",
        name="Главный учебный корпус ТулГУ",
        short_name="Главный",
        kind="academic",
        building_number="Главный",
        address="Тула, проспект Ленина, 92",
        entrance_hint="",
        aliases=["гл", "главный"],
        complex_slug="main-9",
        dgis_url="https://2gis.ru/tula/geo/5067185235966202",
        dgis_object_id="5067185235966202",
        dgis_complex_id=None,
        source_url="https://tulsu.ru/facilities/academic-building/4",
        latitude=None,
        longitude=None,
        sort_order=0,
        verified_at=None,
        rooms=[],
    )

    assert building.latitude is None
    assert building.dgis_url.host == "2gis.ru"


def test_schedule_location_aliases_do_not_guess_similar_buildings() -> None:
    assert alias_matches_location("Гл-401", "гл")
    assert alias_matches_location("9–311", "9")
    assert alias_matches_location("10-205", "10")
    assert not alias_matches_location("10-205", "1")
    assert not alias_matches_location("неизвестный корпус", "9")


def test_floors_widget_is_enabled_only_for_verified_complexes() -> None:
    complexes = {
        building["slug"]: building["dgis_complex_id"] for building in BUILDINGS
    }

    assert complexes["main"] == "5067185235966202"
    assert complexes["building-9"] == complexes["main"]
    assert complexes["building-3"] == "70000001096985234"
    assert complexes["building-2"] is None
    assert complexes["laboratory-6"] is None


def test_official_dormitory_catalog_has_direct_2gis_cards() -> None:
    numbers = [dormitory["building_number"] for dormitory in DORMITORIES]

    assert numbers == [
        "1",
        "2",
        "3",
        "4/1",
        "4/2",
        "6/1",
        "6/2",
        "7",
        "8",
        "9",
        "10",
        "11",
    ]
    assert all(dormitory["kind"] == "dormitory" for dormitory in DORMITORIES)
    assert all("/firm/" in dormitory["dgis_url"] for dormitory in DORMITORIES)
    assert all(
        dormitory["latitude"] and dormitory["longitude"]
        for dormitory in DORMITORIES
    )


def test_all_published_campus_locations_have_map_coordinates() -> None:
    assert all(
        location["latitude"] and location["longitude"]
        for location in [*BUILDINGS, *DORMITORIES]
    )


def test_foc_has_a_searchable_direct_map_card() -> None:
    foc = next(building for building in BUILDINGS if building["slug"] == "foc")

    assert foc["short_name"] == "ФОЦ"
    assert foc["address"] == "Тула, проспект Ленина, 84 к1"
    assert foc["dgis_url"] == "https://2gis.ru/tula/firm/5067077861791631"
    assert foc["latitude"] == "54.171858"
    assert foc["longitude"] == "37.592401"
    assert alias_matches_location("ФОЦ", "фоц")
    assert alias_matches_location("ФОЦ бассейн", "фоц")


def test_release_room_catalog_contains_requested_student_services() -> None:
    main_rooms = {
        room["room_number"]: (room["title"], room["directions"])
        for room in ROOMS_BY_BUILDING["main"]
    }

    assert main_rooms["111"][0] == "Отдел стипендий"
    assert main_rooms["124"][0] == "Архив"
    assert main_rooms["133"][0] == "Библиотека"
    assert main_rooms["133а"][0] == "Студенческое пространство"
    assert "Переход между 9-м и главным корпусами" in main_rooms["001"][1]
    assert "сектор студентов" in main_rooms["229"][1]
    assert ROOMS_BY_BUILDING["building-9"][0]["title"] == "Фойе актового зала"
