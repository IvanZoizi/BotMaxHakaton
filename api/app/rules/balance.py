from __future__ import annotations

from datetime import date

# ст. 115 ТК РФ: 28 календарных дней в год -> 28/12 = 2.33(3) дня за каждый
# полностью отработанный месяц. README §9 №17 — остаток на произвольную дату.
ACCRUAL_PER_MONTH = 28 / 12


def _full_months_between(start: date, end: date) -> int:
    """Число полных календарных месяцев между start и end (end >= start).

    "Полный" — день месяца в end не раньше дня месяца в start (тот же
    принцип, что employee.category-независимый _add_months в checks.py, но
    в обратную сторону: считаем месяцы, а не дату по числу месяцев).
    """
    months = (end.year - start.year) * 12 + (end.month - start.month)
    if end.day < start.day:
        months -= 1
    return max(months, 0)


def accrued_balance(base_days: float, base_date: date, as_of: date) -> float:
    """Остаток на дату `as_of`, если на дату `base_date` он был `base_days`.

    `as_of` раньше `base_date` не накапливает (и не списывает) — это снимок
    в прошлом, а не проекция назад.
    """
    if as_of <= base_date:
        return base_days
    months = _full_months_between(base_date, as_of)
    return round(base_days + months * ACCRUAL_PER_MONTH, 2)
