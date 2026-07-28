from __future__ import annotations

import asyncio

from sqlalchemy import select

from app.db import SessionFactory
from app.models import ResourceCategory, ResourceLink

RESOURCE_SEED = {
    "important": (
        "Важное",
        [
            ("Тульский государственный университет", "https://vk.ru/newstulgu"),
            ("Профбюро ИПМКН ТулГУ", "https://vk.ru/profburo_ipmkn_tsu"),
            ("Профком студентов и аспирантов ТулГУ", "https://vk.ru/profcom_tsu"),
            ("ИПМКН@ТулГУ = {кибернетика, мехмат}", "https://vk.ru/pm2kn"),
            ("Официальный сайт ТулГУ", "https://tulsu.ru/"),
        ],
    ),
    "discounts": (
        "Скидки",
        [
            ("Приложение «СКС РФ»", "https://vk.ru/sksbonus"),
            ("«СКС РФ» Тула | Профком-дисконт ТулГУ", "https://vk.ru/sks_tsu"),
        ],
    ),
    "events": (
        "Мероприятия",
        [
            ("Студенческая викторина MoreQuiz ТулГУ", "https://vk.ru/morequiz"),
            ("Игра «Аллигатор»", "https://vk.ru/krocodil_v_tulgu"),
            ("Игра «Угадай мелодию»", "https://vk.ru/music_tulgu"),
        ],
    ),
    "extra": (
        "Дополнительно",
        [
            ("Библиотека ТулГУ", "https://vk.ru/tulgulib"),
            ("Кафедра иностранных языков ТулГУ", "https://vk.ru/club216049008"),
        ],
    ),
}


async def seed_resources() -> dict[str, int]:
    created_categories = 0
    created_links = 0
    async with SessionFactory() as db:
        for category_order, (slug, (title, links)) in enumerate(RESOURCE_SEED.items()):
            category = await db.scalar(
                select(ResourceCategory).where(ResourceCategory.slug == slug)
            )
            if category is None:
                category = ResourceCategory(
                    slug=slug,
                    title=title,
                    sort_order=category_order,
                )
                db.add(category)
                await db.flush()
                created_categories += 1
            for link_order, (link_title, url) in enumerate(links):
                exists = await db.scalar(
                    select(ResourceLink).where(ResourceLink.url == url)
                )
                if exists is None:
                    db.add(
                        ResourceLink(
                            category_id=category.id,
                            title=link_title,
                            url=url,
                            sort_order=link_order,
                        )
                    )
                    created_links += 1
        await db.commit()
    return {"categories": created_categories, "links": created_links}


if __name__ == "__main__":
    print(asyncio.run(seed_resources()))

