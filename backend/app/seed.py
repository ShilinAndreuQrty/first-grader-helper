from __future__ import annotations

import asyncio

from app.campus.seed import seed_campus
from app.db import SessionFactory
from app.events.seed import archive_unverified_union_meeting
from app.knowledge.seed import apply_seed
from app.onboarding.seed import seed_onboarding
from app.students.seed import seed_resources


async def seed_all() -> dict[str, object]:
    """Run every idempotent seed in dependency-safe order."""
    async with SessionFactory() as db:
        knowledge = await apply_seed(db)
    return {
        "knowledge": knowledge,
        "resources": await seed_resources(),
        "events": {
            "archived_legacy": await archive_unverified_union_meeting(),
        },
        "campus": await seed_campus(),
        "onboarding": {"created": await seed_onboarding()},
    }


if __name__ == "__main__":
    print(asyncio.run(seed_all()))
