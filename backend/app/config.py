from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file="../.env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: Literal["development", "test", "production"] = "development"
    app_name: str = "ИПМКН Старт"
    app_public_url: str = "http://localhost:5173"
    api_public_url: str = "http://localhost:8000/api"
    app_secret_key: str = "development-only-secret-change-before-production"  # noqa: S105
    database_url: str = "sqlite+aiosqlite:///./ipmkn.sqlite3"
    timezone: str = "Europe/Moscow"
    allowed_origins: str = "http://localhost:5173"
    cookie_secure: bool = False
    cookie_samesite: Literal["lax", "none"] = "lax"
    dev_auth_enabled: bool = True
    session_ttl_seconds: int = 86_400
    vk_launch_max_age_seconds: int = 900
    vk_app_id: str = ""
    vk_app_secret: str = ""
    vk_service_token: str = Field(default="", repr=False)
    vk_community_id: int | None = None
    vk_community_token: str = Field(default="", repr=False)
    vk_notifications_enabled: bool = False
    bootstrap_admin_vk_ids: str = ""
    notifications_enabled: bool = False
    notification_poll_seconds: float = 5
    tulsu_schedule_base_url: str = "https://tulsu.ru"
    tulsu_timeout_seconds: float = 8
    tulsu_cache_ttl_seconds: int = 900
    ai_assistant_enabled: bool = False
    openrouter_api_key: str = Field(default="", repr=False)
    openrouter_model: str = ""
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    openrouter_timeout_seconds: float = Field(default=8, ge=1, le=30)
    openrouter_daily_request_limit: int = Field(default=100, ge=0, le=10_000)
    assistant_top_n: int = Field(default=3, ge=1, le=5)
    assistant_rate_limit_per_minute: int = Field(default=30, ge=1, le=300)

    @property
    def origins(self) -> list[str]:
        return [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]

    @property
    def sync_database_url(self) -> str:
        return (
            self.database_url.replace("+asyncpg", "+psycopg")
            .replace("+aiosqlite", "")
        )

    @model_validator(mode="after")
    def reject_unsafe_production_settings(self) -> Settings:
        if self.app_env == "production":
            if self.dev_auth_enabled:
                raise ValueError("DEV_AUTH_ENABLED must be false in production")
            if len(self.app_secret_key) < 32 or self.app_secret_key.startswith("development"):
                raise ValueError("APP_SECRET_KEY must be a strong production secret")
            if not self.cookie_secure:
                raise ValueError("COOKIE_SECURE must be true in production")
            if self.cookie_samesite != "none":
                raise ValueError("COOKIE_SAMESITE must be none for VK web iframe")
        if self.ai_assistant_enabled and not self.openrouter_api_key:
            raise ValueError(
                "OPENROUTER_API_KEY is required when AI_ASSISTANT_ENABLED=true"
            )
        if self.ai_assistant_enabled and not self.openrouter_model:
            raise ValueError(
                "OPENROUTER_MODEL is required when AI_ASSISTANT_ENABLED=true"
            )
        if self.notifications_enabled and not self.vk_community_token:
            raise ValueError(
                "VK_COMMUNITY_TOKEN is required when NOTIFICATIONS_ENABLED=true"
            )
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
