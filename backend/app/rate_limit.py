from __future__ import annotations

import time
from collections import defaultdict, deque

from fastapi import HTTPException, status


class InMemoryRateLimiter:
    """Small per-process limiter for MVP; production can replace it behind this API."""

    def __init__(self) -> None:
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def check(self, key: str, *, limit: int, window_seconds: int) -> None:
        now = time.monotonic()
        threshold = now - window_seconds
        hits = self._hits[key]
        while hits and hits[0] < threshold:
            hits.popleft()
        if len(hits) >= limit:
            raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Too many requests")
        hits.append(now)
