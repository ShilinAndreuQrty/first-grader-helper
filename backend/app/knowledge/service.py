from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from app.knowledge.retrieval import (
    DeterministicRetrievalProvider,
    is_publicly_available,
    public_entry,
    rank_entries,
)
from app.models import FaqEntry


class FaqSelector(Protocol):
    async def select_faq_ids(
        self,
        question: str,
        entries: list[FaqEntry],
    ) -> list[str]:
        """Select only IDs from the supplied, already filtered context."""


@dataclass(frozen=True)
class AssistantRun:
    result: dict
    ai_status: str
    ai_attempted: bool = False


class GroundedAssistantService:
    """Use AI only for selection; all displayed facts come from stored FAQ text."""

    def __init__(
        self,
        selector: FaqSelector | None = None,
        *,
        top_n: int = 3,
    ) -> None:
        self.selector = selector
        self.top_n = top_n
        self.fallback = DeterministicRetrievalProvider()

    async def answer(
        self,
        text: str,
        entries: list[FaqEntry],
        selected_faq_id: str | None = None,
    ) -> AssistantRun:
        deterministic = self.fallback.answer(text, entries, selected_faq_id)
        if selected_faq_id or self.selector is None:
            return AssistantRun(deterministic, "disabled")

        ranked = rank_entries(text, entries)
        candidates = [item.entry for item in ranked if item.score >= 45][: self.top_n]
        if not candidates:
            return AssistantRun(deterministic, "insufficient_context")

        try:
            selected_ids = await self.selector.select_faq_ids(text, candidates)
        except Exception:
            return AssistantRun(deterministic, "provider_error", ai_attempted=True)

        allowed = {entry.id: entry for entry in candidates}
        if (
            not selected_ids
            or len(selected_ids) > self.top_n
            or len(set(selected_ids)) != len(selected_ids)
            or any(faq_id not in allowed for faq_id in selected_ids)
        ):
            return AssistantRun(deterministic, "invalid_response", ai_attempted=True)

        selected = [allowed[faq_id] for faq_id in selected_ids]
        if not all(is_publicly_available(entry) for entry in selected):
            return AssistantRun(deterministic, "invalid_response", ai_attempted=True)
        return AssistantRun(
            grounded_answer(selected),
            "used",
            ai_attempted=True,
        )


def grounded_answer(entries: list[FaqEntry]) -> dict:
    if len(entries) == 1:
        message = entries[0].answer_markdown
    else:
        message = "\n\n".join(
            f"{entry.question}\n{entry.answer_markdown}" for entry in entries
        )
    verified_dates = [entry.verified_at for entry in entries if entry.verified_at]
    sources = [
        {
            "title": entry.question,
            "url": entry.source_url,
            "verified_at": entry.verified_at,
        }
        for entry in entries
    ]
    return {
        "type": "answer",
        "answer": public_entry(entries[0]),
        "message": message,
        "faq_ids": [entry.id for entry in entries],
        "suggestions": [],
        "confidence": "high",
        "sources": sources,
        "verified_at": max(verified_dates) if verified_dates else None,
        "mode": "grounded_ai",
    }
