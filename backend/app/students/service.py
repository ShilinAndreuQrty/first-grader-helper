from __future__ import annotations

import re
import unicodedata

SPACE_RE = re.compile(r"\s+")
DASH_RE = re.compile(r"[‐‑‒–—−]+")
GROUP_CODE_RE = re.compile(r"^\d{6}(?:-\d{2})?$")


def normalize_group_code(value: str) -> str:
    """Normalize typography without guessing a different group number."""
    value = unicodedata.normalize("NFKC", value).strip().upper()
    value = DASH_RE.sub("-", value)
    return SPACE_RE.sub("", value)


def is_valid_group_code(value: str) -> bool:
    return GROUP_CODE_RE.fullmatch(normalize_group_code(value)) is not None


def require_valid_group_code(value: str) -> str:
    normalized = normalize_group_code(value)
    if GROUP_CODE_RE.fullmatch(normalized) is None:
        raise ValueError("Group code must contain six digits and optional two-digit suffix")
    return normalized
