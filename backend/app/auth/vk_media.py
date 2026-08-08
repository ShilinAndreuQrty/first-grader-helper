from __future__ import annotations

from time import monotonic
from urllib.parse import urlparse

import httpx

VK_API_URL = "https://api.vk.com/method"
VK_API_VERSION = "5.199"
VK_AVATAR_CACHE_SECONDS = 60 * 60

_avatar_cache: dict[str, tuple[float, str | None]] = {}


def vk_screen_name(value: str) -> str | None:
    parsed = urlparse(value)
    if parsed.scheme != "https" or parsed.hostname not in {"vk.ru", "www.vk.ru", "m.vk.ru"}:
        return None
    screen_name = parsed.path.strip("/").split("/", 1)[0].strip()
    return screen_name or None


def _response_payload(payload: object) -> object | None:
    if not isinstance(payload, dict) or "error" in payload:
        return None
    return payload.get("response")


async def _vk_method(
    http: httpx.AsyncClient,
    method: str,
    *,
    token: str,
    params: dict[str, str],
) -> object | None:
    try:
        response = await http.get(
            f"{VK_API_URL}/{method}",
            params={**params, "access_token": token, "v": VK_API_VERSION},
        )
        response.raise_for_status()
        return _response_payload(response.json())
    except (httpx.HTTPError, ValueError):
        return None


def _first_item(payload: object) -> dict[str, object] | None:
    if isinstance(payload, list) and payload and isinstance(payload[0], dict):
        return payload[0]
    if isinstance(payload, dict):
        groups = payload.get("groups")
        if isinstance(groups, list) and groups and isinstance(groups[0], dict):
            return groups[0]
    return None


async def resolve_vk_avatar(vk_url: str, *, token: str) -> str | None:
    screen_name = vk_screen_name(vk_url)
    if not screen_name or not token:
        return None

    cached = _avatar_cache.get(screen_name)
    now = monotonic()
    if cached and cached[0] > now:
        return cached[1]

    async with httpx.AsyncClient(timeout=5, follow_redirects=False) as http:
        resolved = await _vk_method(
            http,
            "utils.resolveScreenName",
            token=token,
            params={"screen_name": screen_name},
        )
        photo_url: str | None = None
        if isinstance(resolved, dict):
            object_id = resolved.get("object_id")
            object_type = resolved.get("type")
            if isinstance(object_id, int) and object_type == "user":
                profile = _first_item(
                    await _vk_method(
                        http,
                        "users.get",
                        token=token,
                        params={"user_ids": str(object_id), "fields": "photo_200"},
                    )
                )
                if profile and isinstance(profile.get("photo_200"), str):
                    photo_url = profile["photo_200"]
            elif isinstance(object_id, int) and object_type in {"group", "page", "event"}:
                group = _first_item(
                    await _vk_method(
                        http,
                        "groups.getById",
                        token=token,
                        params={"group_id": str(object_id), "fields": "photo_200"},
                    )
                )
                if group and isinstance(group.get("photo_200"), str):
                    photo_url = group["photo_200"]

    if photo_url and not photo_url.startswith("https://"):
        photo_url = None
    _avatar_cache[screen_name] = (now + VK_AVATAR_CACHE_SECONDS, photo_url)
    return photo_url
