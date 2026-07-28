from datetime import UTC, datetime, timedelta

import httpx
import pytest

from app.models import ExternalScheduleCache
from app.schedule.client import TulsuClient, TulsuUnavailable
from app.schedule.service import cache_is_fresh, normalize_lessons


@pytest.mark.asyncio
async def test_dictionary_filters_groups() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path.endswith("GetDictionaries.php")
        return httpx.Response(
            200,
            json=[
                {"value": "Б260211", "SORT": "1"},
                {"value": "Бабкина Елена Евгеньевна", "SORT": "2"},
            ],
        )

    async with httpx.AsyncClient(
        base_url="https://tulsu.example",
        transport=httpx.MockTransport(handler),
    ) as http:
        assert await TulsuClient(http).group_suggestions("Б") == ["Б260211"]


@pytest.mark.asyncio
async def test_schedule_contract_normalizes_captured_fields() -> None:
    async def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json=[
                {
                    "DATE_Z": "03.09.2026",
                    "TIME_Z": "09:40 - 11:10",
                    "DISCIP": "Программирование",
                    "KOW": "лек.",
                    "CLASS": "lecture",
                    "AUD": "Гл-401",
                    "PREP": "Иванов И.И.",
                }
            ],
        )

    async with httpx.AsyncClient(
        base_url="https://tulsu.example",
        transport=httpx.MockTransport(handler),
    ) as http:
        rows = await TulsuClient(http).schedule("Б260211")
    lesson = normalize_lessons(rows)[0]
    assert lesson.date.isoformat() == "2026-09-03"
    assert lesson.room == "Гл-401"


@pytest.mark.asyncio
async def test_invalid_json_and_timeout_are_safe_failures() -> None:
    def invalid(_: httpx.Request) -> httpx.Response:
        return httpx.Response(200, content=b"not-json")

    async with httpx.AsyncClient(
        base_url="https://tulsu.example",
        transport=httpx.MockTransport(invalid),
    ) as http:
        with pytest.raises(TulsuUnavailable):
            await TulsuClient(http).schedule("Б260211")


def test_cache_freshness_supports_sqlite_naive_datetimes() -> None:
    now = datetime.now(UTC)
    fresh = ExternalScheduleCache(
        cache_key="group:test",
        payload_json="{}",
        expires_at=(now + timedelta(minutes=5)).replace(tzinfo=None),
    )
    stale = ExternalScheduleCache(
        cache_key="group:old",
        payload_json="{}",
        expires_at=(now - timedelta(seconds=1)).replace(tzinfo=None),
    )
    assert cache_is_fresh(fresh, now)
    assert not cache_is_fresh(stale, now)
