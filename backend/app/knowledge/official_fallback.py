from __future__ import annotations

from dataclasses import dataclass

from app.knowledge.importer import normalize_text


@dataclass(frozen=True)
class OfficialTulsuPage:
    title: str
    url: str
    message: str
    keywords: tuple[str, ...]


# This is a deliberately small allowlist, not a general web search. It keeps the
# assistant on specific official pages and avoids scraping search results at runtime.
OFFICIAL_TULSU_PAGES = (
    OfficialTulsuPage(
        title="Общежития ТулГУ",
        url="https://tulsu.ru/facilities/dormitory",
        message=(
            "Актуальный перечень общежитий и их адреса опубликован на официальной странице ТулГУ."
        ),
        keywords=("общежит", "общага", "заселение"),
    ),
    OfficialTulsuPage(
        title="Расписание ТулГУ",
        url="https://tulsu.ru/schedule/",
        message=("Актуальное расписание можно проверить в официальном сервисе расписания ТулГУ."),
        keywords=("расписание", "пары", "занятия"),
    ),
    OfficialTulsuPage(
        title="Ежемесячная материальная помощь",
        url=("https://tulsu.ru/scholarship/financial-assistance/monthly-financial-assistance"),
        message=(
            "Актуальные условия ежемесячной материальной помощи "
            "опубликованы на официальной странице ТулГУ."
        ),
        keywords=("ежемесячная помощь", "материальная помощь каждый месяц"),
    ),
    OfficialTulsuPage(
        title="Единовременная материальная помощь",
        url=("https://tulsu.ru/scholarship/financial-assistance/one-time-financial-assistance"),
        message=(
            "Актуальные условия единовременной материальной помощи "
            "опубликованы на официальной странице ТулГУ."
        ),
        keywords=("единовременная помощь", "разовая материальная помощь"),
    ),
)


class OfficialTulsuFallbackProvider:
    """Return only a verified official page when no published FAQ can answer."""

    def answer(self, text: str) -> dict | None:
        normalized = normalize_text(text)
        page = next(
            (
                item
                for item in OFFICIAL_TULSU_PAGES
                if any(keyword in normalized for keyword in item.keywords)
            ),
            None,
        )
        if page is None:
            return None
        return {
            "type": "answer",
            "answer": None,
            "message": page.message,
            "faq_ids": [],
            "suggestions": [],
            "confidence": "medium",
            "sources": [],
            "official_source": {
                "title": page.title,
                "url": page.url,
            },
            "verified_at": None,
            "mode": "official_tulsu",
        }
