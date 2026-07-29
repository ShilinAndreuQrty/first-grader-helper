from __future__ import annotations

import re
import unicodedata


def normalize_campus_query(value: str) -> str:
    normalized = unicodedata.normalize("NFKC", value).casefold().replace("ё", "е")
    normalized = re.sub(r"[\u2010-\u2015\u2212]", "-", normalized)
    normalized = re.sub(r"[.,()№]", " ", normalized)
    return re.sub(r"\s+", " ", normalized).strip()


def alias_matches_location(value: str, alias: str) -> bool:
    location = normalize_campus_query(value)
    candidate = normalize_campus_query(alias)
    if not candidate:
        return False
    return (
        location == candidate
        or location.startswith(f"{candidate}-")
        or location.startswith(f"{candidate} ")
    )
