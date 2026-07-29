from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Protocol

from app.knowledge.official_fallback import OfficialTulsuFallbackProvider
from app.knowledge.openrouter import GroundedAnswerPayload
from app.knowledge.retrieval import (
    DeterministicRetrievalProvider,
    is_publicly_available,
    public_entry,
    rank_entries,
)
from app.models import FaqEntry

HARD_DETAIL_RE = re.compile(r"https?://[^\s<>)]+|(?<!\w)\d[\d.,:%/–—-]*", re.IGNORECASE)


class FaqComposer(Protocol):
    async def compose_answer(
        self,
        question: str,
        entries: list[FaqEntry],
    ) -> GroundedAnswerPayload:
        """Compose an answer and cite only IDs from the supplied context."""


@dataclass(frozen=True)
class AssistantRun:
    result: dict
    ai_status: str
    ai_attempted: bool = False


class GroundedAssistantService:
    """Let AI rephrase selected FAQ facts while deterministic retrieval stays available."""

    def __init__(
        self,
        composer: FaqComposer | None = None,
        *,
        top_n: int = 3,
    ) -> None:
        self.composer = composer
        self.top_n = top_n
        self.fallback = DeterministicRetrievalProvider()
        self.official_fallback = OfficialTulsuFallbackProvider()

    async def answer(
        self,
        text: str,
        entries: list[FaqEntry],
        selected_faq_id: str | None = None,
    ) -> AssistantRun:
        deterministic = self.fallback.answer(text, entries, selected_faq_id)
        if selected_faq_id or self.composer is None:
            return AssistantRun(
                self._with_official_fallback(text, deterministic),
                "disabled",
            )

        ranked = rank_entries(text, entries)
        candidates = [item.entry for item in ranked if item.score >= 45][: self.top_n]
        if not candidates:
            return AssistantRun(
                self._with_official_fallback(text, deterministic),
                "insufficient_context",
            )

        try:
            composed = await self.composer.compose_answer(text, candidates)
        except Exception:
            return AssistantRun(
                self._with_official_fallback(text, deterministic),
                "provider_error",
                ai_attempted=True,
            )

        allowed = {entry.id: entry for entry in candidates}
        if (
            not composed.answer.strip()
            or not composed.faq_ids
            or len(composed.faq_ids) > self.top_n
            or len(set(composed.faq_ids)) != len(composed.faq_ids)
            or any(faq_id not in allowed for faq_id in composed.faq_ids)
        ):
            return AssistantRun(
                self._with_official_fallback(text, deterministic),
                "invalid_response",
                ai_attempted=True,
            )

        selected = [allowed[faq_id] for faq_id in composed.faq_ids]
        if not all(
            is_publicly_available(entry) for entry in selected
        ) or not hard_details_are_grounded(composed.answer, selected):
            return AssistantRun(
                self._with_official_fallback(text, deterministic),
                "invalid_response",
                ai_attempted=True,
            )
        return AssistantRun(
            grounded_answer(selected, composed.answer.strip()),
            "used",
            ai_attempted=True,
        )

    def _with_official_fallback(self, text: str, result: dict) -> dict:
        if result["type"] != "not_found":
            return result
        return self.official_fallback.answer(text) or result


def grounded_answer(entries: list[FaqEntry], message: str | None = None) -> dict:
    if message is None:
        message = (
            entries[0].answer_markdown
            if len(entries) == 1
            else "\n\n".join(f"{entry.question}\n{entry.answer_markdown}" for entry in entries)
        )
    verified_dates = [entry.verified_at for entry in entries if entry.verified_at]
    return {
        "type": "answer",
        "answer": public_entry(entries[0]),
        "message": message,
        "faq_ids": [entry.id for entry in entries],
        "suggestions": [],
        "confidence": "high",
        "sources": [],
        "official_source": None,
        "verified_at": max(verified_dates) if verified_dates else None,
        "mode": "grounded_ai",
    }


def hard_details_are_grounded(answer: str, entries: list[FaqEntry]) -> bool:
    """Reject newly invented URLs and numeric facts while allowing natural phrasing."""
    context = "\n".join(
        " ".join(
            value for value in (entry.question, entry.answer_markdown, entry.source_url) if value
        )
        for entry in entries
    ).casefold()
    return all(match.group(0).casefold() in context for match in HARD_DETAIL_RE.finditer(answer))
