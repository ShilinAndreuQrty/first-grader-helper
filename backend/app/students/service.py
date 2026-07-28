from __future__ import annotations

import re
import unicodedata

SPACE_RE = re.compile(r"\s+")
DASH_RE = re.compile(r"[‐‑‒–—−]+")


def normalize_group_code(value: str) -> str:
    """Normalize typography without guessing a different group number."""
    value = unicodedata.normalize("NFKC", value).strip().upper()
    value = DASH_RE.sub("-", value)
    return SPACE_RE.sub("", value)

