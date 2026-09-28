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
    pay_by = request.start_date - timedelta(days=PAY_DEADLINE_DAYS)
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
