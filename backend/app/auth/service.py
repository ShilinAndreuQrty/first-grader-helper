from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
from dataclasses import dataclass
from datetime import timedelta
from typing import Literal
from urllib.parse import parse_qsl, urlencode

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import Settings
from app.models import User, UserRole, UserSession, utc_now


@dataclass(frozen=True)
class VerifiedLaunch:
    vk_user_id: int
    vk_app_id: str
    issued_at: int
    params: dict[str, str]


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def build_vk_signature(params: dict[str, str], secret: str) -> str:
    signed = sorted((key, value) for key, value in params.items() if key.startswith("vk_"))
    query = urlencode(signed)
    digest = hmac.new(secret.encode("utf-8"), query.encode("utf-8"), hashlib.sha256).digest()
    return base64.urlsafe_b64encode(digest).decode("ascii").rstrip("=")


def validate_vk_launch_params(
    launch_params: str,
    *,
    secret: str,
    expected_app_id: str | None = None,
    max_age_seconds: int,
    now_timestamp: int | None = None,
) -> VerifiedLaunch:
    if not secret:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "VK auth is not configured")

    params = dict(parse_qsl(launch_params.removeprefix("?"), keep_blank_values=True))
    supplied_sign = params.pop("sign", "")
    if not supplied_sign:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing VK signature")

    expected_sign = build_vk_signature(params, secret)
    if not hmac.compare_digest(supplied_sign, expected_sign):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid VK signature")

    try:
        vk_app_id = params["vk_app_id"]
        vk_user_id = int(params["vk_user_id"])
        issued_at = int(params["vk_ts"])
    except (KeyError, ValueError) as exc:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "Invalid VK launch parameters",
        ) from exc

    if expected_app_id is not None and vk_app_id != expected_app_id:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Unexpected VK application")

    now = int(utc_now().timestamp()) if now_timestamp is None else now_timestamp
    if issued_at > now + 60 or now - issued_at > max_age_seconds:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Expired VK launch parameters")

    return VerifiedLaunch(
        vk_user_id=vk_user_id,
        vk_app_id=vk_app_id,
        issued_at=issued_at,
        params=params,
    )


def resolve_vk_app(
    launch_params: str,
    settings: Settings,
) -> tuple[Literal["public", "admin"], str, str]:
    params = dict(parse_qsl(launch_params.removeprefix("?"), keep_blank_values=True))
    app_id = params.get("vk_app_id", "")
    if app_id and app_id == settings.vk_app_id:
        return "public", settings.vk_app_id, settings.vk_app_secret
    if app_id and app_id == settings.vk_admin_app_id:
        return "admin", settings.vk_admin_app_id, settings.vk_admin_app_secret
    raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Unknown VK application")


def parse_bootstrap_admins(value: str) -> set[int]:
    result: set[int] = set()
    for item in value.split(","):
        item = item.strip()
        if not item:
            continue
        try:
            result.add(int(item))
        except ValueError as exc:
            raise ValueError("BOOTSTRAP_ADMIN_VK_IDS must contain integers") from exc
    return result


async def get_or_create_user(
    session: AsyncSession,
    *,
    vk_user_id: int,
    display_name: str,
    first_name: str = "",
    last_name: str = "",
    settings: Settings,
    force_superadmin: bool = False,
) -> User:
    user = await session.scalar(
        select(User).options(selectinload(User.roles)).where(User.vk_user_id == vk_user_id)
    )
    if user is None:
        user = User(
            vk_user_id=vk_user_id,
            display_name=display_name,
            first_name=first_name,
            last_name=last_name,
            roles=[],
        )
        session.add(user)
        await session.flush()
    else:
        if display_name and display_name != user.display_name:
            user.display_name = display_name
        if first_name and first_name != user.first_name:
            user.first_name = first_name
        if last_name and last_name != user.last_name:
            user.last_name = last_name

    is_bootstrap_admin = vk_user_id in parse_bootstrap_admins(settings.bootstrap_admin_vk_ids)
    if force_superadmin or is_bootstrap_admin:
        if not user.has_any_role({"superadmin"}):
            user.roles.append(UserRole(role="superadmin"))

    await session.commit()
    await session.refresh(user, attribute_names=["roles"])
    return user


async def create_session(
    session: AsyncSession,
    *,
    user: User,
    settings: Settings,
    app_variant: Literal["public", "admin"],
) -> tuple[str, str, UserSession]:
    token = secrets.token_urlsafe(32)
    csrf_token = secrets.token_urlsafe(24)
    user_session = UserSession(
        token_hash=hash_token(token),
        csrf_hash=hash_token(csrf_token),
        app_variant=app_variant,
        user_id=user.id,
        expires_at=utc_now() + timedelta(seconds=settings.session_ttl_seconds),
    )
    session.add(user_session)
    await session.commit()
    return token, csrf_token, user_session
