from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.config import Settings


def production_settings(**overrides: object) -> Settings:
    """Build a minimal safe production configuration for focused validation tests."""
    values: dict[str, object] = {
        "app_env": "production",
        "app_secret_key": "a" * 32,
        "cookie_secure": True,
        "cookie_samesite": "none",
        "dev_auth_enabled": False,
        "vk_app_id": "100",
        "vk_app_secret": "public-secret",
        "vk_admin_app_id": "200",
        "vk_admin_app_secret": "admin-secret",
    }
    values.update(overrides)
    return Settings(**values)


def test_production_accepts_secure_cross_site_session_cookie() -> None:
    settings = production_settings()

    assert settings.cookie_secure is True
    assert settings.cookie_samesite == "none"


def test_production_rejects_lax_cookie_for_vk_iframe() -> None:
    with pytest.raises(ValidationError, match="COOKIE_SAMESITE must be none"):
        production_settings(cookie_samesite="lax")


def test_production_requires_distinct_public_and_admin_vk_apps() -> None:
    with pytest.raises(ValidationError, match="must be different"):
        production_settings(vk_admin_app_id="100")


def test_enabled_assistant_requires_openrouter_model_and_key() -> None:
    with pytest.raises(ValidationError, match="OPENROUTER_API_KEY"):
        Settings(ai_assistant_enabled=True)

    with pytest.raises(ValidationError, match="OPENROUTER_MODEL"):
        Settings(
            ai_assistant_enabled=True,
            openrouter_api_key="test-only-token",
        )
