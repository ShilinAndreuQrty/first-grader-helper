from datetime import UTC, datetime

from app.models import NotificationJob
from app.notifications.providers import FakeProvider
from app.notifications.service import enqueue_once


async def test_fake_provider_has_explicit_delivery_result() -> None:
    provider = FakeProvider()
    job = NotificationJob(
        id="job",
        idempotency_key="event:1:user:1",
        user_id="user",
        scheduled_for=datetime.now(UTC),
        payload_json='{"title":"Встреча","body":"Через час"}',
    )

    first = await provider.send(job, 1)
    second = await provider.send(job, 1)

    assert first.success and second.success
    assert first.provider_message_id == second.provider_message_id
    assert provider.calls == ["job", "job"]


def test_notification_job_key_is_unique_in_model() -> None:
    unique_indexes = [
        index
        for index in NotificationJob.__table__.indexes
        if index.unique
        and [column.name for column in index.columns] == ["idempotency_key"]
    ]
    assert unique_indexes


async def test_enqueue_is_idempotent_for_same_key() -> None:
    class FakeSession:
        def __init__(self) -> None:
            self.job: NotificationJob | None = None
            self.add_count = 0

        async def scalar(self, statement):
            del statement
            return self.job

        def add(self, job: NotificationJob) -> None:
            self.job = job
            self.add_count += 1

        async def flush(self) -> None:
            return None

    db = FakeSession()
    values = {
        "idempotency_key": "event:1:user:1",
        "user_id": "user",
        "scheduled_for": datetime.now(UTC),
        "title": "Встреча",
        "body": "Через час",
    }

    first = await enqueue_once(db, **values)  # type: ignore[arg-type]
    second = await enqueue_once(db, **values)  # type: ignore[arg-type]

    assert first is second
    assert db.add_count == 1
