from datetime import UTC, datetime, timedelta

import pytest
from pydantic import ValidationError

from app.admin.schemas import BuildingWrite, EventWrite


def test_event_form_rejects_inverted_dates() -> None:
    starts_at = datetime.now(UTC)
    with pytest.raises(ValidationError, match="ends_at must be later"):
        EventWrite(
            title="Встреча с тьютором",
            starts_at=starts_at,
            ends_at=starts_at - timedelta(minutes=1),
        )


def test_building_form_rejects_untrusted_url_and_coordinates() -> None:
    with pytest.raises(ValidationError):
        BuildingWrite(
            name="Главный корпус",
            short_name="Главный",
            address="Тула",
            dgis_url="javascript:alert(1)",
            latitude=100,
        )
