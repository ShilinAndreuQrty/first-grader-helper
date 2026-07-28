from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class VkAuthRequest(BaseModel):
    launch_params: str = Field(min_length=10, max_length=4096)


class DevAuthRequest(BaseModel):
    vk_user_id: int = Field(default=1, ge=1)
    display_name: str = Field(default="Локальный разработчик", max_length=160)
    profile: Literal["student", "superadmin"] = "superadmin"


class AuthUser(BaseModel):
    id: str
    vk_user_id: int
    display_name: str
    roles: list[str]


class AuthResponse(BaseModel):
    user: AuthUser
    csrf_token: str
    mode: Literal["vk", "development"]
