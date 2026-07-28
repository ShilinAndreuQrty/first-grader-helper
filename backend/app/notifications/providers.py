from __future__ import annotations

import hashlib
from dataclasses import dataclass
from typing import Protocol

import httpx

from app.models import NotificationJob


@dataclass
class DeliveryResult:
    success: bool
    provider_message_id: str = ""
    error_code: str = ""


class NotificationProvider(Protocol):
    name: str

    async def send(self, job: NotificationJob, vk_user_id: int) -> DeliveryResult: ...


class InAppProvider:
    name = "in_app"

    async def send(self, job: NotificationJob, vk_user_id: int) -> DeliveryResult:
        del vk_user_id
        return DeliveryResult(success=True, provider_message_id=job.id)


class FakeProvider:
    name = "fake"

    def __init__(self, *, succeeds: bool = True) -> None:
        self.succeeds = succeeds
        self.calls: list[str] = []

    async def send(self, job: NotificationJob, vk_user_id: int) -> DeliveryResult:
        del vk_user_id
        self.calls.append(job.id)
        return DeliveryResult(
            success=self.succeeds,
            provider_message_id=f"fake:{job.id}" if self.succeeds else "",
            error_code="" if self.succeeds else "fake_failure",
        )


class VkCommunityProvider:
    name = "vk_community"

    def __init__(self, client: httpx.AsyncClient, token: str) -> None:
        self.client = client
        self.token = token

    async def send(self, job: NotificationJob, vk_user_id: int) -> DeliveryResult:
        # VK uses random_id for deduplication. Deriving it from the immutable job
        # key preserves idempotency across worker restarts.
        digest = hashlib.sha256(job.idempotency_key.encode()).digest()
        random_id = int.from_bytes(digest[:4], "big") & 0x7FFFFFFF
        response = await self.client.post(
            "https://api.vk.com/method/messages.send",
            data={
                "user_id": vk_user_id,
                "random_id": random_id,
                "message": job.payload_json,
                "access_token": self.token,
                "v": "5.199",
            },
        )
        try:
            payload = response.json()
        except ValueError:
            return DeliveryResult(success=False, error_code="invalid_response")
        if response.is_error or "error" in payload:
            code = str(payload.get("error", {}).get("error_code", "http_error"))
            return DeliveryResult(success=False, error_code=code)
        return DeliveryResult(
            success=True,
            provider_message_id=str(payload.get("response", "")),
        )

