from __future__ import annotations

import asyncio
import logging

from app.config import get_settings

logger = logging.getLogger("ipmkn.worker")


async def run() -> None:
    settings = get_settings()
    logging.basicConfig(level=logging.INFO)
    logger.info("worker started; notifications_enabled=%s", settings.notifications_enabled)
    # Queue polling is added with the notification domain. Waiting on an event keeps
    # the Compose contract stable without a busy loop in the scaffold.
    await asyncio.Event().wait()


if __name__ == "__main__":
    asyncio.run(run())
