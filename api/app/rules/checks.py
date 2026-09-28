from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

from .calculation import Calculation
from .context import EmployeeContext, LeaveRequestContext
from .models import Rule

PRIVILEGED_CATEGORIES: dict[str, str] = {
    "multiple_children": "многодетный родитель — ст. 262.2 ТК РФ",
    "minor": "работник младше 18 лет — ст. 267 ТК РФ",
    "donor": "почётный донор — ст. 262.2 ТК РФ",
    "chernobyl": "лицо, пострадавшее вследствие радиационных аварий — ст. 262.2 ТК РФ",
    "spouse_of_military": "супруг(а) военнослужащего — ст. 262.2 ТК РФ",
}


@dataclass(frozen=True)
class CheckOutcome:
    passed: bool
    message: str


CheckHandler = Callable[[Rule, EmployeeContext, LeaveRequestContext, Calculation], "CheckOutcome | None"]

CHECK_REGISTRY: dict[str, CheckHandler] = {}


def register(name: str) -> Callable[[CheckHandler], CheckHandler]:
    def decorator(handler: CheckHandler) -> CheckHandler:
        CHECK_REGISTRY[name] = handler
        return handler

    return decorator


@register("sufficient_balance")
def check_sufficient_balance(rule, employee, request, calc):
    passed = calc.chargeable_days <= employee.leave_balance_days
    template = rule.messages.pass_ if passed else rule.messages.fail
    message = template.format(balance=employee.leave_balance_days, requested=calc.chargeable_days)
    return CheckOutcome(passed=passed, message=message)


@register("min_part_14_days")
def check_min_part_14_days(rule, employee, request, calc):
    already_has_long_part = any(days >= 14 for days in employee.approved_leave_parts_this_year)
    passed = calc.calendar_days >= 14 or already_has_long_part
    template = rule.messages.pass_ if passed else rule.messages.fail
    message = template.format(days=calc.calendar_days)
    return CheckOutcome(passed=passed, message=message)


@register("notice_period_14_days")
def check_notice_period(rule, employee, request, calc):
    passed = calc.days_until_start >= 14
    template = rule.messages.pass_ if passed else rule.messages.fail
    message = template.format(days_until_start=calc.days_until_start, notify_by=calc.notify_by.isoformat())
    return CheckOutcome(passed=passed, message=message)


@register("holidays_recalculation")
def check_holidays(rule, employee, request, calc):
    passed = len(calc.holidays) == 0
    if passed:
        message = rule.messages.pass_.format(calendar_days=calc.calendar_days)
    else:
        message = rule.messages.fail.format(
            holidays_count=len(calc.holidays),
            calendar_days=calc.calendar_days,
            chargeable_days=calc.chargeable_days,
        )
    return CheckOutcome(passed=passed, message=message)


@register("pay_deadline_3_days")
def check_pay_deadline(rule, employee, request, calc):
    message = rule.messages.pass_.format(pay_by=calc.pay_by.isoformat())
    return CheckOutcome(passed=True, message=message)


@register("no_leave_two_years_row")
def check_no_leave_two_years_row(rule, employee, request, calc):
    if employee.last_leave_end_date is None:
        return None  # нет данных о прошлых отпусках — предупреждать не о чем
    today = request.as_of_today()
    years_since_last_leave = today.year - employee.last_leave_end_date.year
    passed = years_since_last_leave < 2
    template = rule.messages.pass_ if passed else rule.messages.fail
    message = template.format(last_leave_end=employee.last_leave_end_date.isoformat())
    return CheckOutcome(passed=passed, message=message)


@register("privileged_category")
def check_privileged_category(rule, employee, request, calc):
    if not employee.category or employee.category not in PRIVILEGED_CATEGORIES:
        return None  # проверка неприменима к этому сотруднику — не включаем в checks[]
    message = rule.messages.pass_.format(category=PRIVILEGED_CATEGORIES[employee.category])
    return CheckOutcome(passed=True, message=message)


@register("team_overlap")
def check_team_overlap(rule, employee, request, calc):
    overlaps = [
        overlap
        for overlap in request.team_overlaps
        if overlap.start_date <= request.end_date and overlap.end_date >= request.start_date
    ]
    passed = not overlaps
    if passed:
        message = rule.messages.pass_
    else:
        names = ", ".join(overlap.full_name for overlap in overlaps)
        message = rule.messages.fail.format(names=names)
    return CheckOutcome(passed=passed, message=message)


@register("schedule_t7_match")
def check_schedule_t7_match(rule, employee, request, calc):
    return None  # график Т-7 вне MVP (README, раздел 16, п.4) — источника данных для сверки ещё нет
