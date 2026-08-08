from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import OnboardingStep, UserOnboardingProgress


async def complete_onboarding_step(
    db: AsyncSession,
    *,
    user_id: str,
    slug: str,
) -> None:
    step = await db.scalar(
        select(OnboardingStep).where(
            OnboardingStep.slug == slug,
            OnboardingStep.status == "published",
            OnboardingStep.deleted_at.is_(None),
        )
    )
    if step is None:
        return
    progress = await db.get(
        UserOnboardingProgress,
        {"user_id": user_id, "step_id": step.id},
    )
    if progress is None:
        db.add(UserOnboardingProgress(user_id=user_id, step_id=step.id))
