from __future__ import annotations

import json
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    NotificationDelivery,
    NotificationJob,
    User,
)
from app.notifications.providers import NotificationProvider


async def enqueue_once(
    db: AsyncSession,
    *,
    idempotency_key: str,
    user_id: str,
    scheduled_for: datetime,
    title: str,
    body: str,
    channel: str = "in_app",
    event_id: str | None = None,
    series_id: str | None = None,
    occurrence_start: datetime | None = None,
) -> NotificationJob:
    existing = await db.scalar(
        select(NotificationJob).where(
            NotificationJob.idempotency_key == idempotency_key
        )
    )
    if existing:
        return existing
    job = NotificationJob(
        idempotency_key=idempotency_key,
        user_id=user_id,
        event_id=event_id,
        series_id=series_id,
        occurrence_start=occurrence_start,
        scheduled_for=scheduled_for,
        channel=channel,
        payload_json=json.dumps({"title": title, "body": body}, ensure_ascii=False),
    )
    db.add(job)
    await db.flush()
    return job


async def process_job(
    db: AsyncSession,
    job: NotificationJob,
    provider: NotificationProvider,
) -> NotificationDelivery:
    existing = await db.scalar(
        select(NotificationDelivery).where(NotificationDelivery.job_id == job.id)
    )
    if existing:
        return existing
    user = await db.get(User, job.user_id)
    if user is None:
        raise ValueError("Notification user no longer exists")
    result = await provider.send(job, user.vk_user_id)
    delivery = NotificationDelivery(
        job_id=job.id,
        provider=provider.name,
        status="delivered" if result.success else "failed",
        provider_message_id=result.provider_message_id,
        error_code=result.error_code,
        delivered_at=datetime.now(UTC) if result.success else None,
    )
    db.add(delivery)
    job.status = "delivered" if result.success else "retry"
    job.attempts += 1
    job.last_error = result.error_code[:200]
    await db.commit()
    return delivery


async def claim_due_job(db: AsyncSession) -> NotificationJob | None:
    now = datetime.now(UTC)
    job = await db.scalar(
        select(NotificationJob)
        .where(
            NotificationJob.status.in_(("pending", "retry")),
            NotificationJob.scheduled_for <= now,
            NotificationJob.attempts < 5,
        )
        .order_by(NotificationJob.scheduled_for)
        .with_for_update(skip_locked=True)
        .limit(1)
    )
    if job:
        job.status = "processing"
        job.locked_at = now
        await db.commit()
    return job

