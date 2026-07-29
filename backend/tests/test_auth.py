from __future__ import annotations

import asyncio
from base64 import urlsafe_b64encode
from collections.abc import Iterator
from datetime import UTC, datetime
from hashlib import sha256
from hmac import new
from pathlib import Path
from urllib.parse import urlencode

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.auth.service import build_vk_signature, parse_bootstrap_admins, validate_vk_launch_params
from app.config import Settings, get_settings
from app.db import Base, get_session
from app.main import app
from app.models import User, UserRole

TEST_SIGNING_KEY = "unit-test-vk-signing-key"  # noqa: S105
TEST_APP_SECRET = "unit-test-app-secret-with-32-characters"  # noqa: S105


def signed_query(params: dict[str, str], secret: str) -> str:
    query = urlencode(sorted(params.items()))
    digest = new(secret.encode(), query.encode(), sha256).digest()
    sign = urlsafe_b64encode(digest).decode().rstrip("=")
    return urlencode({**params, "sign": sign})


@pytest.fixture
def auth_client(tmp_path: Path) -> Iterator[TestClient]:
    test_engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'auth.sqlite3'}")
    session_factory = async_sessionmaker(test_engine, expire_on_commit=False)

    async def prepare_database() -> None:
        async with test_engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)

    async def override_session() -> Iterator[object]:
        async with session_factory() as session:
            yield session

    asyncio.run(prepare_database())
    app.dependency_overrides[get_session] = override_session
    app.dependency_overrides[get_settings] = lambda: Settings(
        app_env="test",
        app_secret_key=TEST_APP_SECRET,
        database_url=f"sqlite+aiosqlite:///{tmp_path / 'auth.sqlite3'}",
        dev_auth_enabled=True,
        vk_app_secret=TEST_SIGNING_KEY,
    )
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()
    asyncio.run(test_engine.dispose())


def test_vk_signature_validation_accepts_authentic_params() -> None:
    params = {
        "vk_app_id": "42",
        "vk_user_id": "123",
        "vk_ts": "1_000".replace("_", ""),
        "vk_platform": "desktop_web",
    }
    launch = validate_vk_launch_params(
        signed_query(params, TEST_SIGNING_KEY),
        secret=TEST_SIGNING_KEY,
        max_age_seconds=300,
        now_timestamp=1_100,
    )

    assert launch.vk_user_id == 123
    assert build_vk_signature(params, "secret") in signed_query(params, "secret")


def test_vk_signature_validation_rejects_tampering() -> None:
    params = {"vk_app_id": "42", "vk_user_id": "123", "vk_ts": "1000"}
    query = signed_query(params, TEST_SIGNING_KEY).replace("vk_user_id=123", "vk_user_id=999")

    with pytest.raises(HTTPException, match="Invalid VK signature"):
        validate_vk_launch_params(
            query,
            secret=TEST_SIGNING_KEY,
            max_age_seconds=300,
            now_timestamp=1_100,
        )


def test_vk_signature_validation_rejects_expired_launch() -> None:
    params = {"vk_app_id": "42", "vk_user_id": "123", "vk_ts": "1000"}

    with pytest.raises(HTTPException, match="Expired VK launch"):
        validate_vk_launch_params(
            signed_query(params, TEST_SIGNING_KEY),
            secret=TEST_SIGNING_KEY,
            max_age_seconds=60,
            now_timestamp=1_100,
        )


def test_role_check_and_bootstrap_parser() -> None:
    user = User(vk_user_id=123, roles=[UserRole(role="content_editor")])

    assert user.has_any_role({"content_editor"})
    assert not user.has_any_role({"superadmin"})
    assert parse_bootstrap_admins("1, 2,3") == {1, 2, 3}


def test_dev_auth_creates_cookie_backed_admin_session(auth_client: TestClient) -> None:
    response = auth_client.post(
        "/api/auth/dev",
        json={
            "vk_user_id": 77,
            "display_name": "Test developer",
            "profile": "superadmin",
        },
    )

    assert response.status_code == 200
    assert response.json()["user"]["roles"] == ["superadmin"]
    assert response.json()["user"]["profile_url"] == "https://vk.ru/id77"
    assert "ipmkn_session" in auth_client.cookies
    assert auth_client.get("/api/auth/me").status_code == 200
    assert auth_client.get("/api/admin/dashboard").status_code == 200
    users = auth_client.get("/api/admin/users")
    assert users.status_code == 200
    assert users.json()[0]["vk_user_id"] == 77


def test_student_cannot_open_admin_api(auth_client: TestClient) -> None:
    response = auth_client.post(
        "/api/auth/dev",
        json={
            "vk_user_id": 78,
            "display_name": "Test student",
            "profile": "student",
        },
    )

    assert response.status_code == 200
    assert auth_client.get("/api/admin/dashboard").status_code == 403
    assert auth_client.get("/api/admin/users").status_code == 403


def test_vk_auth_rejects_profile_from_another_user(auth_client: TestClient) -> None:
    params = {
        "vk_app_id": "42",
        "vk_user_id": "123",
        "vk_ts": str(int(datetime.now(UTC).timestamp())),
    }

    response = auth_client.post(
        "/api/auth/vk",
        json={
            "launch_params": signed_query(params, TEST_SIGNING_KEY),
            "profile": {
                "id": 999,
                "first_name": "Чужое",
                "last_name": "Имя",
            },
        },
    )

    assert response.status_code == 401
