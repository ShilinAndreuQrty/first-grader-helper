from __future__ import annotations

from datetime import UTC
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import (
    SESSION_COOKIE,
    get_current_session,
    get_current_user,
    require_csrf,
)
from app.auth.schemas import AuthResponse, AuthUser, DevAuthRequest, VkAuthRequest
from app.auth.service import create_session, get_or_create_user, validate_vk_launch_params
from app.auth.vk_media import resolve_vk_avatar
from app.config import Settings, get_settings
from app.db import get_session
from app.models import User, UserSession, utc_now
from app.rate_limit import InMemoryRateLimiter

router = APIRouter(prefix="/api/auth", tags=["auth"])
limiter = InMemoryRateLimiter()


def auth_user(user: User) -> AuthUser:
    return AuthUser(
        id=user.id,
        vk_user_id=user.vk_user_id,
        display_name=user.display_name,
        first_name=user.first_name,
        last_name=user.last_name,
        profile_url=f"https://vk.ru/id{user.vk_user_id}",
        roles=sorted(user_role.role for user_role in user.roles),
    )


def client_key(request: Request, scope: str) -> str:
    host = request.client.host if request.client else "unknown"
    return f"{scope}:{host}"


def set_session_cookie(response: Response, token: str, settings: Settings) -> None:
    response.set_cookie(
        SESSION_COOKIE,
        token,
        max_age=settings.session_ttl_seconds,
        secure=settings.cookie_secure,
        httponly=True,
        samesite=settings.cookie_samesite,
        path="/",
    )


@router.post("/vk", response_model=AuthResponse)
async def vk_auth(
    payload: VkAuthRequest,
    request: Request,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> AuthResponse:
    limiter.check(client_key(request, "vk-auth"), limit=10, window_seconds=60)
    verified = validate_vk_launch_params(
        payload.launch_params,
        secret=settings.vk_app_secret,
        max_age_seconds=settings.vk_launch_max_age_seconds,
    )
    if payload.profile and payload.profile.id != verified.vk_user_id:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "VK profile does not match launch user")
    first_name = payload.profile.first_name.strip() if payload.profile else ""
    last_name = payload.profile.last_name.strip() if payload.profile else ""
    user = await get_or_create_user(
        db,
        vk_user_id=verified.vk_user_id,
        display_name=" ".join(part for part in (first_name, last_name) if part),
        first_name=first_name,
        last_name=last_name,
        settings=settings,
    )
    token, csrf_token, _ = await create_session(db, user=user, settings=settings)
    set_session_cookie(response, token, settings)
    return AuthResponse(user=auth_user(user), csrf_token=csrf_token, mode="vk")


@router.post("/dev", response_model=AuthResponse)
async def dev_auth(
    payload: DevAuthRequest,
    request: Request,
    response: Response,
    db: Annotated[AsyncSession, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> AuthResponse:
    limiter.check(client_key(request, "dev-auth"), limit=20, window_seconds=60)
    if settings.app_env not in {"development", "test"} or not settings.dev_auth_enabled:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    user = await get_or_create_user(
        db,
        vk_user_id=payload.vk_user_id,
        display_name=payload.display_name,
        first_name=payload.first_name.strip(),
        last_name=payload.last_name.strip(),
        settings=settings,
        force_superadmin=payload.profile == "superadmin",
    )
    token, csrf_token, _ = await create_session(db, user=user, settings=settings)
    set_session_cookie(response, token, settings)
    return AuthResponse(user=auth_user(user), csrf_token=csrf_token, mode="development")


@router.get("/me", response_model=AuthUser)
async def me(user: Annotated[User, Depends(get_current_user)]) -> AuthUser:
    return auth_user(user)


@router.get("/vk-avatar")
async def vk_avatar(
    _: Annotated[User, Depends(get_current_user)],
    settings: Annotated[Settings, Depends(get_settings)],
    url: Annotated[str, Query(min_length=12, max_length=500)],
) -> dict[str, str | None]:
    return {
        "photo_url": await resolve_vk_avatar(
            url,
            token=settings.vk_service_token,
        )
    }


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    response: Response,
    user_session: Annotated[UserSession, Depends(require_csrf)],
    db: Annotated[AsyncSession, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> None:
    await db.execute(
        update(UserSession)
        .where(UserSession.id == user_session.id)
        .values(revoked_at=utc_now().astimezone(UTC))
    )
    await db.commit()
    response.delete_cookie(
        SESSION_COOKIE,
        secure=settings.cookie_secure,
        httponly=True,
        samesite=settings.cookie_samesite,
        path="/",
    )


@router.get("/session", response_model=AuthUser)
async def session_info(
    user_session: Annotated[UserSession, Depends(get_current_session)],
) -> AuthUser:
    return auth_user(user_session.user)
