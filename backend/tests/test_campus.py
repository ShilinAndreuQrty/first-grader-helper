from app.campus.schemas import BuildingRead
from app.campus.seed import BUILDINGS, DORMITORIES
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
