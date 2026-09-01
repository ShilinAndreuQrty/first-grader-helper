import pytest
from pydantic import ValidationError

from app.onboarding.schemas import IssueCreate
from app.onboarding.seed import STEPS


def test_default_route_is_compact_and_unique() -> None:
    assert len(STEPS) == 5
    assert len({step[0] for step in STEPS}) == len(STEPS)
    assert STEPS[0][0] == "choose-group"
    assert STEPS[-1][0] == "open-resources"
    assert all(step[0] != "know-group" for step in STEPS)


def test_issue_report_has_bounded_message() -> None:
    with pytest.raises(ValidationError):
        IssueCreate(context="map", message="x" * 2001)
