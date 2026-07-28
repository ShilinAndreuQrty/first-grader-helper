from __future__ import annotations

import asyncio

from sqlalchemy import select

from app.db import SessionFactory
from app.models import OnboardingStep

STEPS = [
    ("know-group", "Узнать номер группы", "Уточните номер в приказе или у тьютора.", "/schedule"),
    ("choose-group", "Выбрать группу", "Сохраните основную группу в приложении.", "/schedule"),
    ("find-tutor", "Найти тьютора", "Откройте контакт наставника своей группы.", "/more"),
    ("open-schedule", "Открыть расписание", "Проверьте ближайшие занятия.", "/schedule"),
    ("get-pass", "Разобраться с пропуском", "Найдите инструкцию в помощнике.", "/assistant"),
    ("find-office", "Найти дирекцию", "Главный корпус, кабинет 425.", "/map"),
    ("learn-union", "Узнать про профсоюз", "Посмотрите проверенные ответы.", "/assistant"),
    ("check-events", "Проверить мероприятия", "Выберите интересное событие.", "/events"),
    ("save-links", "Сохранить важные ссылки", "Откройте каталог ресурсов.", "/more"),
]


async def seed_onboarding() -> int:
    created = 0
    async with SessionFactory() as db:
        for order, (slug, title, description, action_path) in enumerate(STEPS):
            step = await db.scalar(
                select(OnboardingStep).where(OnboardingStep.slug == slug)
            )
            if step is None:
                db.add(
                    OnboardingStep(
                        slug=slug,
                        title=title,
                        description=description,
                        action_path=action_path,
                        sort_order=order,
                        status="published",
                    )
                )
                created += 1
        await db.commit()
    return created


if __name__ == "__main__":
    print({"created": asyncio.run(seed_onboarding())})

