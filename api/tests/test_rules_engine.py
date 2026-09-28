"""Проверяет движок правил на трёх сценариях демо-скрипта (README §7):
зелёный, жёлтый и красный вердикт с теми же датами и цифрами, что в README.
"""

from __future__ import annotations

from datetime import date

import pytest

from app.rules import EmployeeContext, LeaveRequestContext, RulesEngine, TeamOverlap, VerdictLevel

TODAY = date(2026, 9, 16)


@pytest.fixture()
def engine() -> RulesEngine:
    return RulesEngine()


def marina(**overrides) -> EmployeeContext:
    base = dict(
        id="emp-1",
        full_name="Марина Петрова",
        hire_date=date(2023, 1, 10),
        leave_balance_days=28,
        balance_as_of=TODAY,
    )
    base.update(overrides)
    return EmployeeContext(**base)


def by_rule(checks, rule_id: str):
    return next(c for c in checks if c.rule_id == rule_id)


def test_green_verdict_5_to_18_october(engine: RulesEngine) -> None:
    request = LeaveRequestContext(start_date=date(2026, 10, 5), end_date=date(2026, 10, 18), today=TODAY)
    verdict = engine.evaluate(marina(), request)

    assert verdict.level == VerdictLevel.GREEN
    assert verdict.calendar_days == 14
    assert verdict.chargeable_days == 14
    assert verdict.balance_after == 14
    assert verdict.notify_by == date(2026, 9, 21)
    assert verdict.pay_by == date(2026, 10, 2)
    assert verdict.suggestion is None
    assert all(c.passed for c in verdict.checks)


def test_yellow_verdict_holidays_reduce_chargeable_days(engine: RulesEngine) -> None:
    request = LeaveRequestContext(start_date=date(2026, 12, 30), end_date=date(2027, 1, 12), today=TODAY)
    verdict = engine.evaluate(marina(), request)

    assert verdict.level == VerdictLevel.YELLOW
    assert verdict.calendar_days == 14
    assert verdict.chargeable_days == 6
    holidays_check = by_rule(verdict.checks, "tk.120.holidays")
    assert holidays_check.passed is False
    assert holidays_check.severity.value == "warn"


def test_red_verdict_notice_period_violation_with_suggestion(engine: RulesEngine) -> None:
    request = LeaveRequestContext(start_date=date(2026, 9, 25), end_date=date(2026, 10, 8), today=TODAY)
    verdict = engine.evaluate(marina(), request)

    notice_check = by_rule(verdict.checks, "tk.123.notice")
    assert verdict.level == VerdictLevel.RED
    assert notice_check.passed is False
    assert "9" in notice_check.message
    assert verdict.suggestion is not None
    assert verdict.suggestion.start_date == date(2026, 9, 30)


def test_insufficient_balance_blocks_with_red_level(engine: RulesEngine) -> None:
    request = LeaveRequestContext(start_date=date(2026, 10, 5), end_date=date(2026, 10, 18), today=TODAY)
    verdict = engine.evaluate(marina(leave_balance_days=5), request)

    balance_check = by_rule(verdict.checks, "tk.115.balance")
    assert balance_check.passed is False
    assert verdict.level == VerdictLevel.RED


def test_team_overlap_downgrades_to_yellow(engine: RulesEngine) -> None:
    overlap = TeamOverlap(
        employee_id="emp-2",
        full_name="Алексей К.",
        start_date=date(2026, 10, 10),
        end_date=date(2026, 10, 20),
    )
    request = LeaveRequestContext(
        start_date=date(2026, 10, 5),
        end_date=date(2026, 10, 18),
        today=TODAY,
        team_overlaps=[overlap],
    )
    verdict = engine.evaluate(marina(), request)

    overlap_check = by_rule(verdict.checks, "company.team-overlap")
    assert overlap_check.passed is False
    assert overlap_check.type.value == "company"
    assert "Алексей К." in overlap_check.message
    assert verdict.level == VerdictLevel.YELLOW


def test_privileged_and_history_checks_are_omitted_when_not_applicable(engine: RulesEngine) -> None:
    request = LeaveRequestContext(start_date=date(2026, 10, 5), end_date=date(2026, 10, 18), today=TODAY)
    verdict = engine.evaluate(marina(), request)

    rule_ids = {c.rule_id for c in verdict.checks}
    assert "tk.262-267.privileged-category" not in rule_ids
    assert "tk.124.no-two-years-row" not in rule_ids
    assert "tk.123.schedule-t7" not in rule_ids


def test_privileged_category_check_is_informational(engine: RulesEngine) -> None:
    request = LeaveRequestContext(start_date=date(2026, 10, 5), end_date=date(2026, 10, 18), today=TODAY)
    verdict = engine.evaluate(marina(category="multiple_children"), request)

    check = by_rule(verdict.checks, "tk.262-267.privileged-category")
    assert check.passed is True
    assert check.severity.value == "info"


def test_no_leave_two_years_row_warns_manager(engine: RulesEngine) -> None:
    request = LeaveRequestContext(start_date=date(2026, 10, 5), end_date=date(2026, 10, 18), today=TODAY)
    verdict = engine.evaluate(marina(last_leave_end_date=date(2023, 6, 1)), request)

    check = by_rule(verdict.checks, "tk.124.no-two-years-row")
    assert check.passed is False
    assert verdict.level == VerdictLevel.YELLOW


def test_rules_are_loaded_as_data_with_stable_version(engine: RulesEngine) -> None:
    rules = engine.list_rules()
    assert len(rules) == 9
    assert all(rule.type.value in {"law", "calculation", "company"} for rule in rules)
    assert len(engine.rules_version) == 8  # short sha256 of rules.yaml


def test_end_before_start_is_rejected(engine: RulesEngine) -> None:
    request = LeaveRequestContext(start_date=date(2026, 10, 18), end_date=date(2026, 10, 5), today=TODAY)
    with pytest.raises(ValueError):
        engine.evaluate(marina(), request)
