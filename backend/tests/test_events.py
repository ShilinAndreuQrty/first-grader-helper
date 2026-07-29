from datetime import UTC, date, datetime, time

from app.events.service import expand_weekly_series
from app.models import EventOccurrenceOverride, EventSeries, EventSeriesBlackout


def make_series() -> EventSeries:
    return EventSeries(
        id="series",
        title="Собрание",
        description="",
        event_type="meeting",
        recurrence_weekday=3,
        local_start_time=time(17, 30),
        duration_minutes=60,
        starts_on=date(2026, 9, 1),
        ends_on=date(2026, 9, 30),
        location="Главный корпус, 403",
        organizer="Профбюро",
        status="published",
        is_confirmed=False,
    )


def test_weekly_series_uses_moscow_timezone() -> None:
    occurrences = expand_weekly_series(
        make_series(),
        [],
        datetime(2026, 9, 1, tzinfo=UTC),
        datetime(2026, 10, 1, tzinfo=UTC),
    )

    assert len(occurrences) == 4
    assert occurrences[0].starts_at == datetime(2026, 9, 3, 14, 30, tzinfo=UTC)
    assert occurrences[0].is_confirmed is False


def test_cancel_and_move_are_occurrence_overrides() -> None:
    series = make_series()
    cancelled_start = datetime(2026, 9, 3, 14, 30, tzinfo=UTC)
    moved_start = datetime(2026, 9, 10, 14, 30, tzinfo=UTC)
    overrides = [
        EventOccurrenceOverride(
            series_id=series.id,
            original_start=cancelled_start,
            status="cancelled",
        ),
        EventOccurrenceOverride(
            series_id=series.id,
            original_start=moved_start,
            replacement_start=datetime(2026, 9, 11, 15, 0, tzinfo=UTC),
            replacement_end=datetime(2026, 9, 11, 16, 0, tzinfo=UTC),
            status="moved",
            location="9-й корпус",
            is_confirmed=True,
        ),
    ]

    occurrences = expand_weekly_series(
        series,
        overrides,
        datetime(2026, 9, 1, tzinfo=UTC),
        datetime(2026, 9, 20, tzinfo=UTC),
    )

    assert occurrences[0].status == "cancelled"
    assert occurrences[1].status == "moved"
    assert occurrences[1].location == "9-й корпус"
    assert occurrences[1].is_confirmed is True


def test_blackout_skips_unverified_recurring_occurrences() -> None:
    series = make_series()
    blackout = EventSeriesBlackout(
        series_id=series.id,
        starts_on=date(2026, 9, 7),
        ends_on=date(2026, 9, 20),
        reason="Учебный перерыв",
    )

    occurrences = expand_weekly_series(
        series,
        [],
        datetime(2026, 9, 1, tzinfo=UTC),
        datetime(2026, 10, 15, tzinfo=UTC),
        [blackout],
    )

    assert [item.starts_at.day for item in occurrences] == [3, 24]


def test_series_never_expands_past_verified_end_date() -> None:
    occurrences = expand_weekly_series(
        make_series(),
        [],
        datetime(2026, 9, 1, tzinfo=UTC),
        datetime(2027, 1, 1, tzinfo=UTC),
    )

    assert len(occurrences) == 4
    assert occurrences[-1].starts_at.date() == date(2026, 9, 24)
