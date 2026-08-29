from __future__ import annotations

import hmac
from collections.abc import Callable
from datetime import UTC, timedelta
from typing import Annotated

from fastapi import Cookie, Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.service import hash_token
from app.db import get_session
from app.models import User, UserSession, utc_now

SESSION_COOKIE = "ipmkn_session"


async def get_current_session(
    db: Annotated[AsyncSession, Depends(get_session)],
    session_token: Annotated[str | None, Cookie(alias=SESSION_COOKIE)] = None,
) -> UserSession:
    if not session_token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Authentication required")

    user_session = await db.scalar(
        select(UserSession).where(UserSession.token_hash == hash_token(session_token))
    )
    if user_session is None or not user_session.is_valid or not user_session.user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session is invalid or expired")
    last_seen = user_session.last_seen_at
    if last_seen.tzinfo is None:
        last_seen = last_seen.replace(tzinfo=UTC)
    # A short write throttle keeps "last activity" useful without updating the
    # session row on every API request from an open WebView.
    if utc_now() - last_seen >= timedelta(minutes=5):
        user_session.last_seen_at = utc_now()
        await db.commit()
    return user_session


async def get_current_user(
    user_session: Annotated[UserSession, Depends(get_current_session)],
) -> User:
    return user_session.user


async def require_csrf(
    user_session: Annotated[UserSession, Depends(get_current_session)],
    csrf_token: Annotated[str | None, Header(alias="X-CSRF-Token")] = None,
) -> UserSession:
    if not csrf_token or not hmac.compare_digest(user_session.csrf_hash, hash_token(csrf_token)):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Invalid CSRF token")
    return user_session


async def require_admin_app(
    user_session: Annotated[UserSession, Depends(get_current_session)],
) -> UserSession:
    if user_session.app_variant != "admin":
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            "Admin application session required",
        )
    return user_session


def require_roles(*allowed_roles: str) -> Callable[..., User]:
    allowed = set(allowed_roles)

    async def dependency(
        user: Annotated[User, Depends(get_current_user)],
    ) -> User:
        if not user.has_any_role(allowed):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Insufficient permissions")
        return user

    return dependency
