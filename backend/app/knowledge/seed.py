from __future__ import annotations

import argparse
import asyncio
import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from anyio import Path as AsyncPath
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import SessionFactory
from app.models import FaqCategory, FaqEntry

DEFAULT_SEED = Path(__file__).parent / "seed" / "faq.json"


async def apply_seed(session: AsyncSession, seed_path: Path = DEFAULT_SEED) -> dict[str, int]:
    payload: dict[str, Any] = json.loads(await AsyncPath(seed_path).read_text(encoding="utf-8"))
    categories_by_key: dict[str, FaqCategory] = {}
    for item in payload["categories"]:
        category = await session.scalar(
            select(FaqCategory).where(FaqCategory.source_key == item["source_key"])
        )
        if category is None:
            category = FaqCategory(source_key=item["source_key"])
            session.add(category)
        category.title = item["title"]
        category.sort_order = item["sort_order"]
        categories_by_key[category.source_key] = category
    await session.flush()

    updated = 0
    created = 0
    for item in payload["entries"]:
        entry = await session.scalar(
            select(FaqEntry).where(FaqEntry.source_key == item["source_key"])
        )
        if entry is None:
            entry = FaqEntry(source_key=item["source_key"])
            session.add(entry)
            created += 1
        else:
            updated += 1
        entry.category_id = categories_by_key[item["category_source_key"]].id
        entry.question = item["question"]
        entry.answer_markdown = item["answer_markdown"]
        entry.search_keywords_json = json.dumps(item["search_keywords"], ensure_ascii=False)
        entry.source_url = item["source_url"]
        entry.status = item["status"]
        entry.is_time_sensitive = item["is_time_sensitive"]
        entry.verified_at = (
            datetime(2026, 7, 29, tzinfo=UTC) if item["status"] == "published" else None
        )
    await session.commit()
    return {"created": created, "updated": updated}


async def run(seed_path: Path) -> None:
    async with SessionFactory() as session:
        result = await apply_seed(session, seed_path)
    print(json.dumps(result, ensure_ascii=False))


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed FAQ categories and entries")
    parser.add_argument("--seed", type=Path, default=DEFAULT_SEED)
    args = parser.parse_args()
    asyncio.run(run(args.seed))


if __name__ == "__main__":
    main()
