from __future__ import annotations

import asyncio
import logging

import httpx

from app.config import get_settings
from app.db import SessionFactory
from app.notifications.providers import InAppProvider, VkCommunityProvider
from app.notifications.service import claim_due_job, process_job

logger = logging.getLogger("ipmkn.worker")


async def run() -> None:
    settings = get_settings()
    logging.basicConfig(level=logging.INFO)
    logger.info("worker started; notifications_enabled=%s", settings.notifications_enabled)
    async with httpx.AsyncClient(timeout=8) as http:
        while True:
            async with SessionFactory() as db:
                job = await claim_due_job(db)
                if job:
                    if job.channel == "community_message":
                        if not settings.notifications_enabled:
                            job.status = "blocked"
                            job.last_error = "provider_disabled"
                            await db.commit()
                        else:
                            provider = VkCommunityProvider(
                                http,
                                settings.vk_community_token,
                            )
                            await process_job(db, job, provider)
                    else:
                        await process_job(db, job, InAppProvider())
            await asyncio.sleep(settings.notification_poll_seconds)


if __name__ == "__main__":
    asyncio.run(run())
