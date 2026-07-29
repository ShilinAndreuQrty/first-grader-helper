from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Protocol

from rapidfuzz import fuzz

from app.knowledge.importer import normalize_text
from app.models import FaqEntry

TOKEN_RE = re.compile(r"\w+", re.UNICODE)


@dataclass(frozen=True)
class RankedFaq:
    entry: FaqEntry
    score: float


class AssistantAnswerProvider(Protocol):
    def answer(
        self,
        text: str,
        entries: list[FaqEntry],
        selected_faq_id: str | None = None,
    ) -> dict:
        """Return the stable public assistant response contract."""


def is_publicly_available(entry: FaqEntry, now: datetime | None = None) -> bool:
    current = now or datetime.now(UTC)
    valid_until = entry.valid_until
    if valid_until is not None and valid_until.tzinfo is None:
        valid_until = valid_until.replace(tzinfo=UTC)
    valid_from = entry.valid_from
    if valid_from is not None and valid_from.tzinfo is None:
        valid_from = valid_from.replace(tzinfo=UTC)
    return (
        entry.status == "published"
        and entry.deleted_at is None
        and (valid_from is None or valid_from <= current)
        and (valid_until is None or valid_until >= current)
    )


def keyword_values(entry: FaqEntry) -> list[str]:
    try:
        value = json.loads(entry.search_keywords_json)
    except json.JSONDecodeError:
        return []
    return [str(item) for item in value] if isinstance(value, list) else []


def rank_entries(text: str, entries: list[FaqEntry]) -> list[RankedFaq]:
    query = normalize_text(text).rstrip("?")
    query_tokens = set(TOKEN_RE.findall(query))
    ranked: list[RankedFaq] = []
    for entry in entries:
        if not is_publicly_available(entry):
            continue
        question = normalize_text(entry.question).rstrip("?")
        aliases = [normalize_text(alias) for alias in keyword_values(entry)]
        candidates = [question, *aliases]
        question_score = max(
            max(fuzz.WRatio(query, candidate), fuzz.token_set_ratio(query, candidate))
            for candidate in candidates
        )
        answer_score = fuzz.partial_ratio(query, normalize_text(entry.answer_markdown))
        candidate_tokens = set(TOKEN_RE.findall(" ".join(candidates)))
        overlap = len(query_tokens & candidate_tokens) / max(1, len(query_tokens))
        score = min(100.0, question_score * 0.82 + answer_score * 0.08 + overlap * 10)
        ranked.append(RankedFaq(entry=entry, score=score))
    return sorted(ranked, key=lambda item: (-item.score, item.entry.question))


def public_entry(entry: FaqEntry) -> dict:
    return {
        "id": entry.id,
        "question": entry.question,
        "answer_markdown": entry.answer_markdown,
        "category": entry.category.title,
        "source_url": entry.source_url,
        "verified_at": entry.verified_at,
        "is_time_sensitive": entry.is_time_sensitive,
    }


class DeterministicRetrievalProvider:
    def answer(
        self,
        text: str,
        entries: list[FaqEntry],
        selected_faq_id: str | None = None,
    ) -> dict:
        public_entries = [entry for entry in entries if is_publicly_available(entry)]
        if selected_faq_id:
            selected = next(
                (entry for entry in public_entries if entry.id == selected_faq_id),
                None,
            )
            if selected is not None:
                return self._answer(selected)

        ranked = rank_entries(text, public_entries)
        if not ranked or ranked[0].score < 45:
            return self._not_found()

        top = ranked[0]
        close = [item for item in ranked[:3] if item.score >= max(52, top.score - 8)]
        normalized = normalize_text(text)
        if len(normalized.split()) <= 2 and len(close) >= 2:
            return self._suggestions(close, response_type="clarification")
        if top.score >= 76 and (len(close) == 1 or top.score - close[1].score >= 7):
            return self._answer(top.entry)
        if top.score >= 52:
            return self._suggestions(close or ranked[:3], response_type="suggestions")
        return self._not_found()

    def _answer(self, entry: FaqEntry) -> dict:
        source = {"title": entry.question, "verified_at": entry.verified_at}
        if entry.source_url:
            source["url"] = entry.source_url
        return {
            "type": "answer",
            "answer": public_entry(entry),
            "message": entry.answer_markdown,
            "faq_ids": [entry.id],
            "suggestions": [],
            "confidence": "high",
            "sources": [source],
            "verified_at": entry.verified_at,
            "mode": "retrieval",
        }

    def _suggestions(self, ranked: list[RankedFaq], *, response_type: str) -> dict:
        suggestions = [
            {
                "faq_id": item.entry.id,
                "question": item.entry.question,
                "category": item.entry.category.title,
            }
            for item in ranked[:3]
        ]
        return {
            "type": response_type,
            "answer": None,
            "message": None,
            "faq_ids": [item["faq_id"] for item in suggestions],
            "suggestions": suggestions,
            "confidence": "medium",
            "sources": [],
            "verified_at": None,
            "mode": "retrieval",
        }

    def _not_found(self) -> dict:
        return {
            "type": "not_found",
            "answer": None,
            "message": None,
            "faq_ids": [],
            "suggestions": [],
            "confidence": "low",
            "sources": [],
            "verified_at": None,
            "mode": "retrieval",
        }


def anonymized_query(text: str) -> tuple[str, str]:
    normalized = normalize_text(text)
    query_hash = hashlib.sha256(normalized.encode("utf-8")).hexdigest()
    hint = re.sub(r"\d", "•", normalized)[:120]
    return query_hash, hint
