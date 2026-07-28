from __future__ import annotations

import argparse
import hashlib
import json
import re
import unicodedata
from collections import Counter
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

from docx import Document
from docx.text.hyperlink import Hyperlink
from docx.text.paragraph import Paragraph

CATEGORY_RE = re.compile(r"^\s*(\d{1,2})[.\u00a0]\s*(.+?)\s*$")
URL_RE = re.compile(r"https?://[^\s<>)]+")
QUESTION_RE = re.compile(r"^(.{3,500}?\?)(?:\s*\n\s*(.+))?$", re.DOTALL)
WHITESPACE_RE = re.compile(r"\s+")

TIME_SENSITIVE_MARKERS = (
    "кабинет",
    "график",
    "стипенд",
    "руб",
    "процент",
    "2,5%",
    "общежит",
    "медосмотр",
    "документ",
    "каждый четверг",
    "17:30",
    "26 мая",
    "2024",
    "10 часов",
    "взыскан",
    "перевест",
    "андриянов",
    "иванников",
    "куликова",
    "спортив",
    "секци",
    "справк",
    "заявлен",
)

PUBLISHABLE_STABLE_QUESTIONS = {
    "кто такой тьютор?",
    "кто такой куратор?",
    "кто такой профорг?",
    "что такое академический отпуск?",
    "что такое профсоюз студентов и аспирантов?",
    "что такое профком?",
    "что такое профбюро?",
    "что такое команда организаторов?",
    "что такое скс рф?",
    "что такое посвят «тропа первака»?",
    "что такое выездное обучение «учись быть первым»?",
}

ALIASES = {
    "где я могу посмотреть расписание?": ["пары", "расписание группы", "занятия сегодня"],
    "как найти своего тьютора?": ["найти наставника", "тьютор группы", "мой тьютор"],
    "где находится дирекция?": ["деканат", "дирекция ипмкн", "кабинет дирекции"],
    "как зайти в личный кабинет тулгу?": ["лк тулгу", "личный кабинет", "вход в лк"],
    "как оформить пропуск?": ["карта пропуск", "студенческий пропуск", "получить пропуск"],
    "кому предоставляются места в общежитии?": ["общага", "заселение", "место в общежитии"],
}

TRANSLIT = str.maketrans(
    {
        "а": "a",
        "б": "b",
        "в": "v",
        "г": "g",
        "д": "d",
        "е": "e",
        "ё": "e",
        "ж": "zh",
        "з": "z",
        "и": "i",
        "й": "i",
        "к": "k",
        "л": "l",
        "м": "m",
        "н": "n",
        "о": "o",
        "п": "p",
        "р": "r",
        "с": "s",
        "т": "t",
        "у": "u",
        "ф": "f",
        "х": "h",
        "ц": "c",
        "ч": "ch",
        "ш": "sh",
        "щ": "sch",
        "ъ": "",
        "ы": "y",
        "ь": "",
        "э": "e",
        "ю": "yu",
        "я": "ya",
    }
)


@dataclass
class ImportedFaq:
    category_source_key: str
    question: str
    answer_markdown: str
    search_keywords: list[str]
    source_key: str
    source_url: str | None
    status: str
    is_time_sensitive: bool


@dataclass
class ImportedCategory:
    source_key: str
    title: str
    sort_order: int


@dataclass
class ImportReport:
    categories: int = 0
    questions: int = 0
    links: int = 0
    skipped_paragraphs: int = 0
    duplicates: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


@dataclass
class ImportResult:
    categories: list[ImportedCategory]
    entries: list[ImportedFaq]
    report: ImportReport


def normalize_text(value: str) -> str:
    normalized = unicodedata.normalize("NFKC", value).replace("ё", "е").lower()
    normalized = normalized.replace("–", "-").replace("—", "-").replace("‑", "-")
    normalized = re.sub(r"[^\w\s?«»-]", " ", normalized, flags=re.UNICODE)
    return WHITESPACE_RE.sub(" ", normalized).strip()


def slugify(value: str, *, max_length: int = 96) -> str:
    value = normalize_text(value).translate(TRANSLIT)
    value = re.sub(r"[^a-z0-9]+", "-", value).strip("-")
    if not value:
        value = hashlib.sha1(value.encode(), usedforsecurity=False).hexdigest()[:12]
    return value[:max_length].rstrip("-")


def paragraph_content(paragraph: Paragraph) -> tuple[str, list[str]]:
    parts: list[str] = []
    links: list[str] = []
    for item in paragraph.iter_inner_content():
        if isinstance(item, Hyperlink):
            text = item.text.strip()
            url = item.url
            if url:
                links.append(url)
                parts.append(f"[{text or url}]({url})")
            elif text:
                parts.append(text)
        else:
            parts.append(item.text)

    text = "".join(parts).strip()
    for match in URL_RE.findall(text):
        links.append(match.rstrip(".,"))
    return text, list(dict.fromkeys(links))


def split_question(text: str) -> tuple[str, str] | None:
    match = QUESTION_RE.match(text.strip())
    if not match:
        return None
    question = WHITESPACE_RE.sub(" ", match.group(1)).strip()
    inline_answer = (match.group(2) or "").strip()
    return question, inline_answer


def is_time_sensitive(question: str, answer: str) -> bool:
    """Flag facts that can become stale and require a visible verification date."""
    normalized_content = normalize_text(f"{question} {answer}")
    return any(marker in normalized_content for marker in TIME_SENSITIVE_MARKERS)


def should_review(question: str, answer: str) -> bool:
    normalized_question = normalize_text(question)
    if normalized_question in PUBLISHABLE_STABLE_QUESTIONS:
        return False
    # Without a source verification date, non-definition records stay in review.
    return True


def parse_docx(path: Path) -> ImportResult:
    document = Document(path)
    categories: list[ImportedCategory] = []
    entries: list[ImportedFaq] = []
    report = ImportReport()
    current_category: ImportedCategory | None = None
    current_question: str | None = None
    answer_parts: list[str] = []
    answer_links: list[str] = []
    seen_questions: Counter[str] = Counter()
    duplicate_suffixes: Counter[str] = Counter()

    def flush_entry() -> None:
        nonlocal current_question, answer_parts, answer_links
        if current_question is None or current_category is None:
            return
        answer = "\n\n".join(part for part in answer_parts if part).strip()
        normalized_question = normalize_text(current_question)
        seen_questions[normalized_question] += 1
        if seen_questions[normalized_question] > 1:
            report.duplicates.append(current_question)

        base_key = f"{current_category.source_key}-{slugify(current_question)}"
        duplicate_suffixes[base_key] += 1
        occurrence = duplicate_suffixes[base_key]
        source_key = base_key if occurrence == 1 else f"{base_key}-duplicate-{occurrence}"
        needs_review = should_review(current_question, answer)
        time_sensitive = is_time_sensitive(current_question, answer)
        entries.append(
            ImportedFaq(
                category_source_key=current_category.source_key,
                question=current_question,
                answer_markdown=answer,
                search_keywords=ALIASES.get(normalized_question, []),
                source_key=source_key,
                source_url=answer_links[0] if answer_links else None,
                status="needs_review" if needs_review else "published",
                is_time_sensitive=time_sensitive,
            )
        )
        report.links += len(set(answer_links))
        current_question = None
        answer_parts = []
        answer_links = []

    for paragraph in document.paragraphs:
        text, links = paragraph_content(paragraph)
        if not text:
            report.skipped_paragraphs += 1
            continue

        category_match = CATEGORY_RE.match(text)
        if category_match and 1 <= int(category_match.group(1)) <= 8:
            flush_entry()
            number = int(category_match.group(1))
            current_category = ImportedCategory(
                source_key=f"category-{number}-{slugify(category_match.group(2))}",
                title=category_match.group(2).strip(),
                sort_order=number,
            )
            categories.append(current_category)
            continue

        question_parts = split_question(text)
        if question_parts is not None:
            flush_entry()
            if current_category is None:
                report.warnings.append(f"Question before category: {question_parts[0]}")
                continue
            current_question, inline_answer = question_parts
            if inline_answer:
                answer_parts.append(inline_answer)
                answer_links.extend(links)
            continue

        if current_question is None:
            report.skipped_paragraphs += 1
            continue
        answer_parts.append(text)
        answer_links.extend(links)

    flush_entry()
    report.categories = len(categories)
    report.questions = len(entries)
    if not entries:
        report.warnings.append("No FAQ entries were recognized")
    return ImportResult(categories=categories, entries=entries, report=report)


def result_to_dict(result: ImportResult) -> dict[str, Any]:
    return {
        "schema_version": 1,
        "categories": [asdict(category) for category in result.categories],
        "entries": [asdict(entry) for entry in result.entries],
        "report": asdict(result.report),
    }


def write_result(result: ImportResult, output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        json.dumps(result_to_dict(result), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Import the verified FAQ DOCX into JSON")
    parser.add_argument("source", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    result = parse_docx(args.source)
    write_result(result, args.output)
    print(json.dumps(asdict(result.report), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
