from __future__ import annotations

import json

from app.knowledge.retrieval import DeterministicRetrievalProvider
from app.models import FaqCategory, FaqEntry


def entry(
    entry_id: str,
    question: str,
    answer: str,
    *,
    status: str = "published",
    aliases: list[str] | None = None,
) -> FaqEntry:
    category = FaqCategory(id=f"category-{entry_id}", title="Адаптация", source_key=entry_id)
    return FaqEntry(
        id=entry_id,
        category=category,
        category_id=category.id,
        question=question,
        answer_markdown=answer,
        search_keywords_json=json.dumps(aliases or [], ensure_ascii=False),
        source_key=f"faq-{entry_id}",
        status=status,
        is_time_sensitive=False,
    )


def test_typo_returns_grounded_answer() -> None:
    provider = DeterministicRetrievalProvider()
    entries = [
        entry(
            "tutor",
            "Кто такой тьютор?",
            "Тьютор — старшекурсник, который помогает адаптироваться.",
            aliases=["наставник первокурсника"],
        )
    ]

    result = provider.answer("кто такой тютор", entries)

    assert result["type"] == "answer"
    assert result["faq_ids"] == ["tutor"]
    assert result["answer"]["answer_markdown"] == entries[0].answer_markdown


def test_unpublished_entry_is_never_returned() -> None:
    provider = DeterministicRetrievalProvider()

    result = provider.answer(
        "секретный вопрос",
        [entry("draft", "Секретный вопрос?", "Не публиковать", status="needs_review")],
    )

    assert result["type"] == "not_found"


def test_ambiguous_short_query_requests_clarification() -> None:
    provider = DeterministicRetrievalProvider()
    entries = [
        entry("one", "Как оформить стипендию?", "Ответ 1", aliases=["стипендия"]),
        entry("two", "Как получить социальную стипендию?", "Ответ 2", aliases=["стипендия"]),
    ]

    result = provider.answer("стипендия", entries)

    assert result["type"] == "clarification"
    assert len(result["suggestions"]) == 2


def test_unknown_query_returns_not_found() -> None:
    provider = DeterministicRetrievalProvider()

    result = provider.answer(
        "где купить межпланетный билет",
        [entry("tutor", "Кто такой тьютор?", "Тьютор помогает.")],
    )

    assert result["type"] == "not_found"
