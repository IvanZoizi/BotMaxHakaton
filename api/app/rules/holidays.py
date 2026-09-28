"""Нерабочие праздничные дни — ст. 112 ТК РФ.

Список — фиксированные даты, перечисленные прямо в тексте статьи. Переносы
выходных дней на другие даты (когда праздник совпадает с субботой/воскресеньем)
устанавливаются постановлениями Правительства РФ, а не самим ТК РФ, поэтому
в MVP не учитываются (см. README, раздел 16, п.5 — календарь зашит по базовым
датам ст. 112 на 2026-2027 без учёта переносов).
"""

from __future__ import annotations

from datetime import date

_FIXED_HOLIDAYS: tuple[tuple[int, int], ...] = (
    (1, 1),
    (1, 2),
    (1, 3),
    (1, 4),
    (1, 5),
    (1, 6),
    (1, 8),  # Новогодние каникулы
    (1, 7),  # Рождество Христово
    (2, 23),  # День защитника Отечества
    (3, 8),  # Международный женский день
    (5, 1),  # Праздник Весны и Труда
    (5, 9),  # День Победы
    (6, 12),  # День России
    (11, 4),  # День народного единства
)


def holidays_for_year(year: int) -> frozenset[date]:
    return frozenset(date(year, month, day) for month, day in _FIXED_HOLIDAYS)


def holidays_in_range(start: date, end: date) -> list[date]:
    all_days: set[date] = set()
    for year in range(start.year, end.year + 1):
        all_days |= holidays_for_year(year)
    return sorted(day for day in all_days if start <= day <= end)
