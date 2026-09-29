"""№17: остаток на произвольную дату — 2,33 дня/месяц накопления."""

from __future__ import annotations

from datetime import date

from app.rules.balance import accrued_balance


def test_no_accrual_before_base_date():
    assert accrued_balance(10, date(2026, 9, 1), as_of=date(2026, 8, 1)) == 10


def test_no_accrual_same_day():
    assert accrued_balance(10, date(2026, 9, 1), as_of=date(2026, 9, 1)) == 10


def test_accrues_per_full_month():
    # 3 полных месяца: 1 сентября -> 1 декабря.
    result = accrued_balance(10, date(2026, 9, 1), as_of=date(2026, 12, 1))
    assert result == round(10 + 3 * (28 / 12), 2)


def test_partial_month_not_counted():
    # 1 сентября -> 20 ноября: 2 полных месяца (день 20 < день 1 не в счёт последнего).
    result = accrued_balance(10, date(2026, 9, 1), as_of=date(2026, 11, 20))
    assert result == round(10 + 2 * (28 / 12), 2)


def test_day_of_month_edge_case():
    # 31 января -> 1 марта: меньше месяца до 28 февраля не хватает 3 дней,
    # день (1) < базовый день (31) -> считается только 1 полный месяц.
    result = accrued_balance(0, date(2026, 1, 31), as_of=date(2026, 3, 1))
    assert result == round(1 * (28 / 12), 2)
