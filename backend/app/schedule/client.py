from __future__ import annotations

import asyncio
from datetime import datetime
from typing import Any, Literal

import httpx
from pydantic import TypeAdapter, ValidationError

from app.schedule.schemas import CalendarPeriod, DictionaryItem, RawScheduleLesson

ALLOWED_ENDPOINTS = {
    "dictionaries": "/schedule/queries/GetDictionaries.php",
    "schedule": "/schedule/queries/GetSchedule.php",
    "dates": "/schedule/queries/GetDates.php",
    "calendar": "/schedule/queries/GetCalendar.php",
}


class TulsuUnavailable(RuntimeError):
    pass


class TulsuClient:
    def __init__(self, client: httpx.AsyncClient) -> None:
        self.client = client

    async def _json(
        self,
        endpoint: Literal["dictionaries", "schedule", "dates", "calendar"],
        *,
        params: dict[str, str] | None = None,
        data: dict[str, str] | None = None,
    ) -> Any:
        path = ALLOWED_ENDPOINTS[endpoint]
        attempts = 2 if data is None else 1
        for attempt in range(attempts):
            try:
                response = await self.client.request(
                    "POST" if data is not None else "GET",
                    path,
                    params=params,
                    data=data,
                )
                response.raise_for_status()
                return response.json()
            except (httpx.HTTPError, ValueError) as error:
                if attempt + 1 < attempts:
                    await asyncio.sleep(0.1)
                    continue
                raise TulsuUnavailable("Tulsu schedule is unavailable") from error
        raise AssertionError("unreachable")

    async def group_suggestions(self, query: str) -> list[str]:
        payload = await self._json("dictionaries", params={"term": query})
        try:
            items = TypeAdapter(list[DictionaryItem]).validate_python(payload)
        except ValidationError as error:
            raise TulsuUnavailable("Invalid Tulsu dictionary response") from error
        # SORT=1 is the group namespace; teachers, rooms and subjects share this API.
        return list(dict.fromkeys(item.value for item in items if item.kind == 1))[:30]

    async def schedule(self, group_code: str) -> list[RawScheduleLesson]:
        payload = await self._json(
            "schedule",
            params={"search_value": group_code, "search_field": "GROUP_P"},
        )
        try:
            return TypeAdapter(list[RawScheduleLesson]).validate_python(payload)
        except ValidationError as error:
            raise TulsuUnavailable("Invalid Tulsu schedule response") from error

    async def calendar(self, group_code: str) -> list[CalendarPeriod]:
        payload = await self._json(
            "calendar",
            params={"search_value": group_code},
        )
        if not isinstance(payload, list):
            raise TulsuUnavailable("Invalid Tulsu calendar response")
        result: list[CalendarPeriod] = []
        for item in payload:
            try:
                result.append(
                    CalendarPeriod(
                        starts_on=datetime.strptime(
                            item["BEGIN_DATE"], "%d.%m.%Y"
                        ).date(),
                        ends_on=datetime.strptime(item["END_DATE"], "%d.%m.%Y").date(),
                        title=item["VID"],
                    )
                )
            except (KeyError, TypeError, ValueError) as error:
                raise TulsuUnavailable("Invalid Tulsu calendar response") from error
        return result

