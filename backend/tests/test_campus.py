from app.campus.schemas import BuildingRead


def test_building_catalog_allows_missing_coordinates() -> None:
    building = BuildingRead(
        id="building",
        name="Главный учебный корпус ТулГУ",
        short_name="Главный",
        address="Тула, проспект Ленина, 92",
        entrance_hint="",
        dgis_url="https://2gis.ru/tula/geo/5067185235966202",
        latitude=None,
        longitude=None,
        verified_at=None,
        rooms=[],
    )

    assert building.latitude is None
    assert building.dgis_url.host == "2gis.ru"
