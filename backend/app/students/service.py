from __future__ import annotations

import re
import unicodedata
from datetime import date, datetime
from zoneinfo import ZoneInfo

SPACE_RE = re.compile(r"\s+")
DASH_RE = re.compile(r"[‐‑‒–—−]+")
GROUP_CODE_RE = re.compile(r"^\d{6}(?:-\d{2})?$")
MOSCOW_TIME_ZONE = ZoneInfo("Europe/Moscow")


def normalize_group_code(value: str) -> str:
    """Normalize typography without guessing a different group number."""
    value = unicodedata.normalize("NFKC", value).strip().upper()
    value = DASH_RE.sub("-", value)
    return SPACE_RE.sub("", value)


def is_valid_group_code(value: str) -> bool:
    return GROUP_CODE_RE.fullmatch(normalize_group_code(value)) is not None


def has_active_tutorship(group_code: str, today: date | None = None) -> bool:
    """Tutors support only the current September-December intake."""
    current_date = today or datetime.now(MOSCOW_TIME_ZONE).date()
    if current_date.month < 9:
        return False

    year_digit = str(current_date.year)[-1]
    normalized = normalize_group_code(group_code)
    regular_code = re.fullmatch(rf"\d{{4}}{year_digit}\d", normalized)
    extended_code = re.fullmatch(rf"\d{{2}}00{year_digit}\d-\d{{2}}", normalized)
    return regular_code is not None or extended_code is not None


def require_valid_group_code(value: str) -> str:
    normalized = normalize_group_code(value)
    if GROUP_CODE_RE.fullmatch(normalized) is None:
        raise ValueError("Group code must contain six digits and optional two-digit suffix")
    return normalized


def normalize_bookmark_label(value: str) -> str:
    """Keep personal labels compact and safe for single-line UI."""
    return SPACE_RE.sub(" ", unicodedata.normalize("NFKC", value).strip())
