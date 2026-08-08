from __future__ import annotations

import asyncio

from sqlalchemy import select

from app.db import SessionFactory
from app.models import OnboardingStep

STEPS = [
    (
        "choose-group",
        "Выбрать свою группу",
        "Укажите учебную группу, чтобы открыть расписание и найти тьютора.",
        "/",
    ),
    ("find-tutor", "Найти тьютора", "Откройте контакт наставника своей группы.", "/more"),
    (
        "get-pass",
        "Разобраться с пропуском",
        "Узнайте, как оформить и восстановить пропуск.",
        "/assistant",
    ),
    (
        "find-office",
        "Найти дирекцию",
        "Запомните корпус и кабинет дирекции ИПМКН.",
        "/map",
    ),
    (
        "learn-union",
        "Узнать про студенческие сообщества",
        "Разберитесь, где следить за новостями и искать помощь.",
        "/assistant",
    ),
    (
        "check-events",
        "Посмотреть ближайшие события",
        "Выберите мероприятие, на которое хочется сходить.",
        "/events",
    ),
    (
        "save-links",
        "Открыть полезные сервисы",
        "Познакомьтесь с учебными системами и важными ссылками.",
        "/resources",
    ),
]

LEGACY_STEP_SLUGS = {"know-group", "open-schedule"}


async def seed_onboarding() -> int:
    created = 0
    async with SessionFactory() as db:
        legacy_steps = (
            await db.scalars(
                select(OnboardingStep).where(
                    OnboardingStep.slug.in_(LEGACY_STEP_SLUGS)
                )
            )
        ).all()
        for step in legacy_steps:
            step.status = "archived"

        for order, (slug, title, description, action_path) in enumerate(STEPS):
            step = await db.scalar(
                select(OnboardingStep).where(OnboardingStep.slug == slug)
            )
            if step is None:
                step = OnboardingStep(
                    slug=slug,
                    title=title,
                    description=description,
                    action_path=action_path,
                    sort_order=order,
                    status="published",
                )
                db.add(step)
                created += 1
            else:
                step.title = title
                step.description = description
                step.action_path = action_path
                step.sort_order = order
                step.status = "published"
        await db.commit()
    return created


if __name__ == "__main__":
    print({"created": asyncio.run(seed_onboarding())})
