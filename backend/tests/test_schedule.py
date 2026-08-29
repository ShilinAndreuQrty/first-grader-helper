from datetime import UTC, datetime, timedelta

import httpx
import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.models import ExternalScheduleCache
from app.schedule.client import TulsuClient, TulsuUnavailable
from app.schedule.service import (
    cache_is_fresh,
    cache_needs_stale_warning,
    get_group_suggestions,
    normalize_lessons,
)


@pytest.mark.asyncio
async def test_dictionary_filters_groups() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path.endswith("GetDictionaries.php")
        return httpx.Response(
            200,
            json=[
                {"value": "Б260211", "SORT": "1"},
                {"value": "220031-22", "SORT": "1"},
                {"value": "220031-22:01", "SORT": "1"},
                {"value": "Бабкина Елена Евгеньевна", "SORT": "2"},
            ],
        )

    async with httpx.AsyncClient(
        base_url="https://tulsu.example",
        transport=httpx.MockTransport(handler),
    ) as http:
        assert await TulsuClient(http).group_suggestions("220031-22") == [
            "220031-22"
        ]


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
        rows = await TulsuClient(http).schedule("220031-22")
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
            await TulsuClient(http).schedule("220031-22")


@pytest.mark.asyncio
async def test_group_search_uses_recent_cache_silently_during_outage() -> None:
    engine = create_async_engine("sqlite+aiosqlite://")
    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    async with engine.begin() as connection:
        await connection.run_sync(
            lambda sync_connection: ExternalScheduleCache.__table__.create(
                sync_connection
            )
        )

    def available(_: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json=[{"value": "220031-22", "SORT": "1"}],
        )

    def unavailable(_: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("offline")

    async with session_factory() as db:
        async with httpx.AsyncClient(
            base_url="https://tulsu.example",
            transport=httpx.MockTransport(available),
        ) as http:
            fresh = await get_group_suggestions(
                db,
                TulsuClient(http),
                "220031-22",
                ttl_seconds=-1,
            )
        async with httpx.AsyncClient(
            base_url="https://tulsu.example",
            transport=httpx.MockTransport(unavailable),
        ) as http:
            stale = await get_group_suggestions(
                db,
                TulsuClient(http),
                "220031-22",
                ttl_seconds=900,
            )

    assert fresh.groups == ["220031-22"]
    assert not fresh.is_stale
    assert stale.groups == ["220031-22"]
    assert not stale.is_stale
    assert stale.fetched_at == fresh.fetched_at
    await engine.dispose()


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


def test_stale_warning_starts_after_five_hours() -> None:
    now = datetime.now(UTC)
    recent = ExternalScheduleCache(
        cache_key="group:recent",
        payload_json="{}",
        fetched_at=(now - timedelta(hours=4, minutes=59)).replace(tzinfo=None),
        expires_at=now,
    )
    old = ExternalScheduleCache(
        cache_key="group:old",
        payload_json="{}",
        fetched_at=(now - timedelta(hours=5, seconds=1)).replace(tzinfo=None),
        expires_at=now,
    )

    assert not cache_needs_stale_warning(recent, now)
    assert cache_needs_stale_warning(old, now)
