from __future__ import annotations

import json
import logging
import time
import uuid
from collections.abc import Awaitable, Callable

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.admin.router import router as admin_router
from app.auth.router import router as auth_router
from app.campus.router import router as campus_router
from app.config import get_settings
from app.db import engine
from app.events.router import router as events_router
from app.knowledge.router import router as knowledge_router
from app.notifications.router import router as notifications_router
from app.onboarding.router import router as onboarding_router
from app.schedule.router import router as schedule_router
from app.students.router import router as students_router

settings = get_settings()
logger = logging.getLogger("ipmkn.http")
app = FastAPI(
    title=f"{settings.app_name} API",
    version="0.1.0",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Content-Type", "X-CSRF-Token", "X-Request-ID"],
)
app.include_router(auth_router)
app.include_router(knowledge_router)
app.include_router(students_router)
app.include_router(events_router)
app.include_router(admin_router)
app.include_router(schedule_router)
app.include_router(campus_router)
app.include_router(notifications_router)
app.include_router(onboarding_router)


@app.middleware("http")
async def request_context(
    request: Request,
    call_next: Callable[[Request], Awaitable[Response]],
) -> Response:
    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    started = time.monotonic()
    response = await call_next(request)
    duration_ms = (time.monotonic() - started) * 1000
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), camera=(), microphone=()"
    response.headers["Server-Timing"] = f"app;dur={duration_ms:.1f}"
    # Query strings are deliberately excluded because VK launch params contain
    # signatures and identifiers that must never reach application logs.
    logger.info(
        json.dumps(
            {
                "event": "http_request",
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "status": response.status_code,
                "duration_ms": round(duration_ms, 1),
            }
        )
    )
    return response


@app.get("/health", tags=["system"])
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/ready", tags=["system"])
async def readiness() -> dict[str, str]:
    async with engine.connect() as connection:
        await connection.execute(text("SELECT 1"))
    return {"status": "ready"}


@app.get("/api/config", tags=["system"])
async def public_config() -> dict[str, str | bool | int | None]:
    return {
        "app_name": settings.app_name,
        "environment": settings.app_env,
        "vk_enabled": bool(settings.vk_app_id),
        "notifications_enabled": settings.notifications_enabled,
        "vk_community_id": settings.vk_community_id,
        "assistant_mode": (
            "grounded_openrouter"
            if settings.ai_assistant_enabled
            else "retrieval"
        ),
    }
