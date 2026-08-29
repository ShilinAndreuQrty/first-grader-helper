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
from app.auth.vk_media import vk_screen_name
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


def test_vk_avatar_accepts_only_vk_profile_urls() -> None:
    assert vk_screen_name("https://vk.ru/shilin_qrty") == "shilin_qrty"
    assert vk_screen_name("https://example.com/vk.ru/shilin_qrty") is None
    assert vk_screen_name("javascript:alert(1)") is None


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
        vk_app_id="42",
        vk_app_secret=TEST_SIGNING_KEY,
        vk_admin_app_id="84",
        vk_admin_app_secret=f"{TEST_SIGNING_KEY}-admin",
        bootstrap_admin_vk_ids="123",
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
        expected_app_id="42",
        max_age_seconds=300,
        now_timestamp=1_100,
    )

    assert launch.vk_user_id == 123
    assert launch.vk_app_id == "42"
    assert build_vk_signature(params, "secret") in signed_query(params, "secret")


def test_vk_signature_validation_rejects_tampering() -> None:
    params = {"vk_app_id": "42", "vk_user_id": "123", "vk_ts": "1000"}
    query = signed_query(params, TEST_SIGNING_KEY).replace("vk_user_id=123", "vk_user_id=999")

    with pytest.raises(HTTPException, match="Invalid VK signature"):
        validate_vk_launch_params(
            query,
            secret=TEST_SIGNING_KEY,
            expected_app_id="42",
            max_age_seconds=300,
            now_timestamp=1_100,
        )


def test_vk_signature_validation_rejects_expired_launch() -> None:
    params = {"vk_app_id": "42", "vk_user_id": "123", "vk_ts": "1000"}

    with pytest.raises(HTTPException, match="Expired VK launch"):
        validate_vk_launch_params(
            signed_query(params, TEST_SIGNING_KEY),
            secret=TEST_SIGNING_KEY,
            expected_app_id="42",
            max_age_seconds=60,
            now_timestamp=1_100,
        )


def test_role_check_and_bootstrap_parser() -> None:
    user = User(vk_user_id=123, roles=[UserRole(role="content_editor")])

    assert user.has_any_role({"content_editor"})
    assert not user.has_any_role({"superadmin"})
    assert parse_bootstrap_admins("1, 2,3") == {1, 2, 3}


def test_dev_auth_creates_cookie_backed_admin_session(auth_client: TestClient) -> None:
    public_response = auth_client.post(
        "/api/auth/dev",
        json={
            "vk_user_id": 77,
            "display_name": "Test developer",
            "profile": "superadmin",
            "app_variant": "public",
        },
    )
    assert public_response.status_code == 200

    response = auth_client.post(
        "/api/auth/dev",
        json={
            "vk_user_id": 77,
            "display_name": "Test developer",
            "profile": "superadmin",
            "app_variant": "admin",
        },
    )

    assert response.status_code == 200
    assert response.json()["user"]["roles"] == ["superadmin"]
    assert response.json()["app_variant"] == "admin"
    assert response.json()["user"]["profile_url"] == "https://vk.ru/id77"
    assert "ipmkn_session" in auth_client.cookies
    assert auth_client.get("/api/auth/me").status_code == 200
    dashboard = auth_client.get("/api/admin/dashboard")
    assert dashboard.status_code == 200
    assert dashboard.json()["total_users"] == 1
    assert dashboard.json()["new_users_7d"] == 1
    assert dashboard.json()["active_users_7d"] == 1
    users = auth_client.get("/api/admin/users")
    assert users.status_code == 200
    assert users.json()[0]["vk_user_id"] == 77
    assert users.json()[0]["launch_count"] == 1


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


def test_public_app_session_cannot_open_admin_api_even_for_superadmin(
    auth_client: TestClient,
) -> None:
    auth_client.post(
        "/api/auth/dev",
        json={
            "vk_user_id": 83,
            "display_name": "Admin in admin app",
            "profile": "superadmin",
            "app_variant": "admin",
        },
    )
    public_auth = auth_client.post(
        "/api/auth/dev",
        json={
            "vk_user_id": 83,
            "display_name": "Admin in public app",
            "profile": "student",
            "app_variant": "public",
        },
    )

    assert public_auth.json()["user"]["roles"] == ["superadmin"]
    assert auth_client.get("/api/admin/dashboard").status_code == 403


def test_signed_vk_sessions_are_bound_to_the_matching_application(
    auth_client: TestClient,
) -> None:
    now = str(int(datetime.now(UTC).timestamp()))
    public_params = {"vk_app_id": "42", "vk_user_id": "123", "vk_ts": now}
    public_auth = auth_client.post(
        "/api/auth/vk",
        json={"launch_params": signed_query(public_params, TEST_SIGNING_KEY)},
    )

    assert public_auth.status_code == 200
    assert public_auth.json()["app_variant"] == "public"
    assert public_auth.json()["user"]["roles"] == ["superadmin"]
    assert auth_client.get("/api/admin/dashboard").status_code == 403

    admin_params = {"vk_app_id": "84", "vk_user_id": "123", "vk_ts": now}
    admin_auth = auth_client.post(
        "/api/auth/vk",
        json={
            "launch_params": signed_query(
                admin_params,
                f"{TEST_SIGNING_KEY}-admin",
            )
        },
    )

    assert admin_auth.status_code == 200
    assert admin_auth.json()["app_variant"] == "admin"
    assert auth_client.get("/api/admin/dashboard").status_code == 200


def test_admin_app_session_still_requires_an_editor_role(auth_client: TestClient) -> None:
    auth_client.post(
        "/api/auth/dev",
        json={
            "vk_user_id": 84,
            "display_name": "Student in admin app",
            "profile": "student",
            "app_variant": "admin",
        },
    )

    assert auth_client.get("/api/admin/dashboard").status_code == 403


def test_student_can_save_any_well_formed_group_code(auth_client: TestClient) -> None:
    auth = auth_client.post(
        "/api/auth/dev",
        json={"vk_user_id": 82, "display_name": "Student", "profile": "student"},
    )
    response = auth_client.post(
        "/api/me/groups/by-code",
        json={"code": "222231", "is_primary": True},
        headers={"X-CSRF-Token": auth.json()["csrf_token"]},
    )

    assert response.status_code == 200
    assert response.json()["code"] == "222231"
    assert response.json()["is_primary"] is True
    assert auth_client.get("/api/me/groups").json()[0]["code"] == "222231"


def test_admin_can_manage_event_and_see_registration(auth_client: TestClient) -> None:
    admin_auth = auth_client.post(
        "/api/auth/dev",
        json={
            "vk_user_id": 79,
            "display_name": "Events admin",
            "profile": "superadmin",
            "app_variant": "admin",
        },
    )
    admin_cookie = auth_client.cookies["ipmkn_session"]
    admin_csrf = admin_auth.json()["csrf_token"]
    payload = {
        "title": "Посвят первокурсников",
        "description": "Знакомство с тьюторами",
        "event_type": "other",
        "starts_at": "2030-09-01T15:00:00Z",
        "ends_at": "2030-09-01T16:30:00Z",
        "location": "Главный корпус, 403",
        "organizer": "ИПМКН",
        "external_url": "https://vk.ru/example",
        "status": "published",
        "occurrence_status": "scheduled",
        "is_confirmed": True,
    }
    created = auth_client.post(
        "/api/admin/events",
        json=payload,
        headers={"X-CSRF-Token": admin_csrf},
    )
    assert created.status_code == 201
    event_id = created.json()["id"]

    student_auth = auth_client.post(
        "/api/auth/dev",
        json={"vk_user_id": 80, "display_name": "Student", "profile": "student"},
    )
    subscribed = auth_client.post(
        "/api/event-subscriptions",
        json={"event_id": event_id},
        headers={"X-CSRF-Token": student_auth.json()["csrf_token"]},
    )
    assert subscribed.status_code == 201

    auth_client.cookies.set("ipmkn_session", admin_cookie)
    events = auth_client.get("/api/admin/events")
    assert events.status_code == 200
    assert events.json()[0]["registration_count"] == 1

    cancelled = auth_client.put(
        f"/api/admin/events/{event_id}",
        json={**payload, "occurrence_status": "cancelled"},
        headers={"X-CSRF-Token": admin_csrf},
    )
    assert cancelled.status_code == 200
    assert cancelled.json()["occurrence_status"] == "cancelled"

    deleted = auth_client.delete(
        f"/api/admin/events/{event_id}",
        headers={"X-CSRF-Token": admin_csrf},
    )
    assert deleted.status_code == 204
    assert auth_client.get("/api/admin/events").json() == []


def test_demo_reset_preserves_admin_and_created_events(auth_client: TestClient) -> None:
    auth = auth_client.post(
        "/api/auth/dev",
        json={
            "vk_user_id": 81,
            "display_name": "Demo admin",
            "profile": "superadmin",
            "app_variant": "admin",
        },
    )
    csrf = auth.json()["csrf_token"]
    payload = {
        "title": "Событие для презентации",
        "description": "",
        "event_type": "other",
        "starts_at": "2030-09-02T15:00:00Z",
        "ends_at": "2030-09-02T16:30:00Z",
        "location": "Главный корпус",
        "organizer": "ИПМКН",
        "external_url": None,
        "status": "published",
        "occurrence_status": "scheduled",
        "is_confirmed": True,
    }
    created = auth_client.post(
        "/api/admin/events",
        json=payload,
        headers={"X-CSRF-Token": csrf},
    )
    event_id = created.json()["id"]
    subscribed = auth_client.post(
        "/api/event-subscriptions",
        json={"event_id": event_id},
        headers={"X-CSRF-Token": csrf},
    )
    assert subscribed.status_code == 201

    reset = auth_client.post(
        "/api/admin/demo/reset-me",
        headers={"X-CSRF-Token": csrf},
    )
    assert reset.status_code == 204
    assert auth_client.get("/api/auth/me").json()["roles"] == ["superadmin"]
    assert auth_client.get("/api/me/event-subscriptions").json() == []
    events = auth_client.get("/api/admin/events").json()
    assert len(events) == 1
    assert events[0]["id"] == event_id
    assert events[0]["registration_count"] == 0


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
