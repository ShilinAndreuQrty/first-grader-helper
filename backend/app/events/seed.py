from __future__ import annotations

import asyncio
from datetime import date, time

from sqlalchemy import select

from app.db import SessionFactory
from app.models import EventSeries


async def seed_unverified_union_meeting() -> bool:
    async with SessionFactory() as db:
        existing = await db.scalar(
            select(EventSeries).where(
                EventSeries.title == "Профсоюзное собрание ИПМКН"
            )
        )
        if existing:
            return False
        # The FAQ contains this schedule, but an editor must set the actual
        # academic-year bounds/exceptions and publish it before users see it.
        db.add(
            EventSeries(
                title="Профсоюзное собрание ИПМКН",
                description="Еженедельная встреча. Требует проверки редактором.",
                event_type="union_meeting",
                recurrence_weekday=3,
                local_start_time=time(17, 30),
                duration_minutes=60,
                starts_on=date(2026, 9, 1),
                ends_on=date(2027, 5, 31),
                location="Главный корпус, кабинет 403",
                organizer="Профбюро ИПМКН",
                status="needs_review",
                is_confirmed=False,
            )
        )
        await db.commit()
        return True


if __name__ == "__main__":
    print({"created": asyncio.run(seed_unverified_union_meeting())})

