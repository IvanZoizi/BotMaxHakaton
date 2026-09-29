from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class JoinDeepLink:
    """Подключение сотрудника к компании — README §2 сценарий 1, §9 №11.

    Само связывание max_user_id <-> employees.id — вне API-контракта
    («СМЕНА — API-контракт», раздел 2, сценарий 1: «Граница: само создание
    связи — вне этого API-контракта, бот-логика») и не задокументировано ни
    в одном источнике (тот же контракт относит весь Admin-контур к GAP-06).
    Парсинг кода здесь реальный; сама привязка — заглушка до решения по GAP-06.
    """

    code: str


@dataclass(frozen=True)
class ShiftOfferDeepLink:
    """`off_<id>` — экран «Предложение смены» (README §7 шаг 6, §9 №19)."""

    offer_id: str


@dataclass(frozen=True)
class ScheduleT7DeepLink:
    """`t7_<год>` — форма отпуска на будущий год (README §9 №24)."""

    year: int


DeepLink = JoinDeepLink | ShiftOfferDeepLink | ScheduleT7DeepLink | None

_JOIN_PREFIX = "join_"
_SHIFT_OFFER_PREFIX = "off_"
_SCHEDULE_T7_PREFIX = "t7_"


def parse_deep_link(payload: str | None) -> DeepLink:
    if not payload:
        return None
    if payload.startswith(_JOIN_PREFIX):
        code = payload.removeprefix(_JOIN_PREFIX)
        return JoinDeepLink(code=code) if code else None
    if payload.startswith(_SHIFT_OFFER_PREFIX):
        offer_id = payload.removeprefix(_SHIFT_OFFER_PREFIX)
        return ShiftOfferDeepLink(offer_id=offer_id) if offer_id else None
    if payload.startswith(_SCHEDULE_T7_PREFIX):
        year_str = payload.removeprefix(_SCHEDULE_T7_PREFIX)
        return ScheduleT7DeepLink(year=int(year_str)) if year_str.isdigit() else None
    return None


def build_join_payload(code: str) -> str:
    return f"{_JOIN_PREFIX}{code}"


def build_shift_offer_payload(offer_id: str) -> str:
    return f"{_SHIFT_OFFER_PREFIX}{offer_id}"


def build_schedule_t7_payload(year: int) -> str:
    return f"{_SCHEDULE_T7_PREFIX}{year}"
