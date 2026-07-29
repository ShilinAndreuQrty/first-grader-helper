from __future__ import annotations

import asyncio
from datetime import UTC, datetime

from sqlalchemy import select

from app.db import SessionFactory
from app.models import EventSeries


async def archive_unverified_union_meeting() -> bool:
    """Archive the legacy guessed series; editors create verified bounded drafts."""

    async with SessionFactory() as db:
        existing = await db.scalar(
            select(EventSeries).where(
                EventSeries.title == "Профсоюзное собрание ИПМКН"
            )
        )
        if existing is None or existing.status == "archived":
            return False
        existing.status = "archived"
        existing.deleted_at = datetime.now(UTC)
        await db.commit()
        return True


if __name__ == "__main__":
    print({"archived_legacy": asyncio.run(archive_unverified_union_meeting())})
