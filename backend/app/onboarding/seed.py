from __future__ import annotations

import asyncio

from sqlalchemy import select

from app.db import SessionFactory
from app.models import OnboardingStep

STEPS = [
    (
        "choose-group",
        "Выбрать свою группу",
        "Укажите учебную группу, чтобы приложение показывало ваше расписание и тьютора.",
        "/",
    ),
    (
        "open-schedule",
        "Открыть расписание",
        "Посмотрите пары на сегодня и откройте полное расписание.",
        "/schedule",
    ),
    (
        "explore-map",
        "Посмотреть карту корпусов",
        "Найдите нужный корпус и проверьте полезные кабинеты.",
        "/map",
    ),
    (
        "open-events",
        "Открыть календарь событий",
        "Посмотрите ближайшие мероприятия и сохраните интересное.",
        "/events",
    ),
    (
        "open-resources",
        "Посмотреть полезные ссылки",
        "Откройте каталог учебных сервисов и студенческих сообществ.",
        "/resources",
    ),
]

LEGACY_STEP_SLUGS = {
    "know-group",
    "find-tutor",
    "get-pass",
    "find-office",
    "learn-union",
    "check-events",
    "save-links",
}


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
