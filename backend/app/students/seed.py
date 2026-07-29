from __future__ import annotations

import asyncio
from dataclasses import dataclass

from sqlalchemy import select

from app.db import SessionFactory
from app.models import ResourceCategory, ResourceLink


@dataclass(frozen=True)
class ResourceSeed:
    slug: str
    title: str
    url: str
    description: str
    icon: str
    source_kind: str
    contexts: tuple[str, ...] = ("catalog",)


RESOURCE_SEED = {
    "important": (
        "Важное",
        [
            ResourceSeed(
                "tulsu-site",
                "Официальный сайт ТулГУ",
                "https://tulsu.ru/",
                "Документы, подразделения и официальная информация университета.",
                "university",
                "official",
                ("catalog", "about", "official_info"),
            ),
            ResourceSeed(
                "tulsu-community",
                "Тульский государственный университет",
                "https://vk.ru/newstulgu",
                "Новости и объявления ТулГУ во ВКонтакте.",
                "university",
                "official",
                ("catalog", "about", "official_info"),
            ),
            ResourceSeed(
                "profburo-ipmkn",
                "Профбюро ИПМКН ТулГУ",
                "https://vk.ru/profburo_ipmkn_tsu",
                "Помощь студентам ИПМКН и информация о собраниях.",
                "community",
                "student",
                ("catalog", "about", "contact", "meeting"),
            ),
            ResourceSeed(
                "profcom-tulsu",
                "Профком студентов и аспирантов ТулГУ",
                "https://vk.ru/profcom_tsu",
                "Общеуниверситетские профсоюзные новости и поддержка.",
                "community",
                "student",
                ("catalog", "contact", "meeting"),
            ),
            ResourceSeed(
                "ipmkn-community",
                "ИПМКН@ТулГУ = {кибернетика, мехмат}",
                "https://vk.ru/pm2kn",
                "Новости института и студенческого сообщества ИПМКН.",
                "institute",
                "student",
                ("catalog", "about", "contact"),
            ),
        ],
    ),
    "discounts": (
        "Скидки",
        [
            ResourceSeed(
                "sks-rf",
                "Приложение «СКС РФ»",
                "https://vk.ru/sksbonus",
                "Федеральные предложения для владельцев студенческих карт.",
                "discount",
                "student",
            ),
            ResourceSeed(
                "sks-tulsu",
                "«СКС РФ» Тула | Профком-дисконт ТулГУ",
                "https://vk.ru/sks_tsu",
                "Локальные предложения профкома для студентов ТулГУ.",
                "discount",
                "student",
            ),
        ],
    ),
    "events": (
        "Мероприятия",
        [
            ResourceSeed(
                "event-morequiz",
                "Студенческая викторина MoreQuiz ТулГУ",
                "https://vk.ru/morequiz",
                "Сообщество студенческой викторины.",
                "event",
                "student",
                ("catalog", "events"),
            ),
            ResourceSeed(
                "event-alligator",
                "Игра «Аллигатор»",
                "https://vk.ru/krocodil_v_tulgu",
                "Сообщество игры и анонсы новых встреч.",
                "event",
                "student",
                ("catalog", "events"),
            ),
            ResourceSeed(
                "event-guess-the-melody",
                "Игра «Угадай мелодию»",
                "https://vk.ru/music_tulgu",
                "Сообщество музыкальной игры ТулГУ.",
                "event",
                "student",
                ("catalog", "events"),
            ),
        ],
    ),
    "extra": (
        "Дополнительно",
        [
            ResourceSeed(
                "tulsu-library",
                "Библиотека ТулГУ",
                "https://vk.ru/tulgulib",
                "Новости библиотеки и помощь с учебными источниками.",
                "library",
                "official",
            ),
            ResourceSeed(
                "tulsu-foreign-languages",
                "Кафедра иностранных языков ТулГУ",
                "https://vk.ru/club216049008",
                "Материалы и объявления кафедры.",
                "education",
                "official",
            ),
        ],
    ),
}


async def seed_resources() -> dict[str, int]:
    created_categories = 0
    created_links = 0
    async with SessionFactory() as db:
        for category_order, (category_slug, (category_title, links)) in enumerate(
            RESOURCE_SEED.items()
        ):
            category = await db.scalar(
                select(ResourceCategory).where(
                    ResourceCategory.slug == category_slug
                )
            )
            if category is None:
                category = ResourceCategory(
                    slug=category_slug,
                    title=category_title,
                    sort_order=category_order,
                )
                db.add(category)
                await db.flush()
                created_categories += 1
            else:
                category.title = category_title
                category.sort_order = category_order

            for link_order, item in enumerate(links):
                link = await db.scalar(
                    select(ResourceLink).where(ResourceLink.url == item.url)
                )
                if link is None:
                    link = ResourceLink(url=item.url)
                    db.add(link)
                    created_links += 1
                link.category_id = category.id
                link.slug = item.slug
                link.title = item.title
                link.description = item.description
                link.icon = item.icon
                link.source_kind = item.source_kind
                link.contexts = ",".join(item.contexts)
                link.sort_order = link_order
                link.is_active = True
                link.deleted_at = None
        await db.commit()
    return {"categories": created_categories, "links": created_links}


if __name__ == "__main__":
    print(asyncio.run(seed_resources()))
