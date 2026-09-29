from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta

from .context import EmployeeContext, LeaveRequestContext
from .holidays import holidays_in_range

NOTICE_PERIOD_DAYS = 14  # ст. 123 ТК РФ
PAY_DEADLINE_DAYS = 3  # ст. 136 ТК РФ


@dataclass(frozen=True)
class Calculation:
    calendar_days: int
    holidays: list[date]
    chargeable_days: int
    notify_by: date
    pay_by: date
    days_until_start: int
    balance_after: float


def calculate(employee: EmployeeContext, request: LeaveRequestContext) -> Calculation:
    if request.end_date < request.start_date:
        raise ValueError("endDate must not be before startDate")

    calendar_days = (request.end_date - request.start_date).days + 1
    holidays = holidays_in_range(request.start_date, request.end_date)
    chargeable_days = max(calendar_days - len(holidays), 0)
    notify_by = request.start_date - timedelta(days=NOTICE_PERIOD_DAYS)
    pay_by = _shift_to_preceding_workday(request.start_date - timedelta(days=PAY_DEADLINE_DAYS))
    days_until_start = (request.start_date - request.as_of_today()).days
    balance_after = round(employee.leave_balance_days - chargeable_days, 2)

    return Calculation(
        calendar_days=calendar_days,
        holidays=holidays,
        chargeable_days=chargeable_days,
        notify_by=notify_by,
        pay_by=pay_by,
        days_until_start=days_until_start,
        balance_after=balance_after,
    )


def _shift_to_preceding_workday(day: date) -> date:
    """Ст. 136 ТК РФ сама не оговаривает перенос при совпадении с выходным для
    отпускных (в отличие от ч. 8 той же статьи — про обычную зарплату). Перенос
    на предшествующий рабочий день — устойчивая практика (Письмо Роструда от
    30.07.2014 N 1693-6-1: банк/бухгалтерия не проводят платежи в выходной),
    не буква кодекса — помечено отдельно от messages в rules.yaml."""
    while day.weekday() >= 5:  # 5=суббота, 6=воскресенье
        day -= timedelta(days=1)
    return day
