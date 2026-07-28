from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, require_csrf
from app.db import get_session
from app.models import (
    FaqEntry,
    FaqFeedback,
    IssueReport,
    OnboardingStep,
    User,
    UserOnboardingProgress,
    UserSession,
)
from app.onboarding.schemas import (
    FaqFeedbackCreate,
    IssueCreate,
    OnboardingStepRead,
    ProgressUpdate,
)

router = APIRouter(prefix="/api", tags=["onboarding"])


@router.get("/onboarding", response_model=list[OnboardingStepRead])
async def onboarding_steps(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_session)],
) -> list[OnboardingStepRead]:
    now = datetime.now(UTC)
    steps = list(
        (
            await db.scalars(
                select(OnboardingStep)
                .where(
                    OnboardingStep.status == "published",
                    OnboardingStep.deleted_at.is_(None),
                    or_(OnboardingStep.valid_from.is_(None), OnboardingStep.valid_from <= now),
                    or_(
                        OnboardingStep.valid_until.is_(None),
                        OnboardingStep.valid_until >= now,
                    ),
                )
                .order_by(OnboardingStep.sort_order)
            )
        ).all()
    )
    completed_ids = set(
        (
            await db.scalars(
                select(UserOnboardingProgress.step_id).where(
                    UserOnboardingProgress.user_id == user.id
                )
            )
        ).all()
    )
    return [
        OnboardingStepRead(
            id=step.id,
            slug=step.slug,
            title=step.title,
            description=step.description,
            action_path=step.action_path,
            sort_order=step.sort_order,
            completed=step.id in completed_ids,
        )
        for step in steps
    ]


@router.put("/onboarding/{step_id}", status_code=status.HTTP_204_NO_CONTENT)
async def update_progress(
    step_id: str,
    payload: ProgressUpdate,
    session: Annotated[UserSession, Depends(require_csrf)],
    db: Annotated[AsyncSession, Depends(get_session)],
) -> None:
    step = await db.get(OnboardingStep, step_id)
    if step is None or step.status != "published":
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Onboarding step not found")
    progress = await db.get(
        UserOnboardingProgress,
        {"user_id": session.user_id, "step_id": step_id},
    )
    if payload.completed and progress is None:
        db.add(
            UserOnboardingProgress(user_id=session.user_id, step_id=step_id)
        )
    elif not payload.completed and progress:
        await db.execute(
            delete(UserOnboardingProgress).where(
                UserOnboardingProgress.user_id == session.user_id,
                UserOnboardingProgress.step_id == step_id,
            )
        )
    await db.commit()


@router.post("/issues", status_code=status.HTTP_201_CREATED)
async def report_issue(
    payload: IssueCreate,
    session: Annotated[UserSession, Depends(require_csrf)],
    db: Annotated[AsyncSession, Depends(get_session)],
) -> dict[str, str]:
    issue = IssueReport(
        user_id=session.user_id,
        context=payload.context,
        message=payload.message,
    )
    db.add(issue)
    await db.commit()
    return {"id": issue.id}


@router.post("/faq/{faq_id}/feedback", status_code=status.HTTP_201_CREATED)
async def faq_feedback(
    faq_id: str,
    payload: FaqFeedbackCreate,
    session: Annotated[UserSession, Depends(require_csrf)],
    db: Annotated[AsyncSession, Depends(get_session)],
) -> dict[str, str]:
    entry = await db.get(FaqEntry, faq_id)
    if entry is None or entry.status != "published" or entry.deleted_at:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "FAQ entry not found")
    feedback = FaqFeedback(
        faq_entry_id=entry.id,
        user_id=session.user_id,
        is_helpful=payload.is_helpful,
        comment=payload.comment,
    )
    db.add(feedback)
    await db.commit()
    return {"id": feedback.id}

