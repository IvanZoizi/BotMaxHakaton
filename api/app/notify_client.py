from __future__ import annotations

import logging
from typing import Any

import httpx

from .config import settings

logger = logging.getLogger(__name__)


def _post(path: str, payload: dict[str, Any]) -> None:
    """Best-effort вызов bot/app/notify.py — сбой уведомления не должен
    откатывать или проваливать основное действие (заявка/предложение уже
    сохранены в БД к моменту вызова), поэтому исключения только логируются."""
    if not settings.bot_base_url:
        logger.info("BOT_BASE_URL не задан — уведомление %s пропущено", path)
        return
    try:
        response = httpx.post(
            f"{settings.bot_base_url}{path}",
            json=payload,
            headers={"X-Internal-Secret": settings.bot_internal_notify_secret},
            timeout=5.0,
        )
        response.raise_for_status()
    except httpx.HTTPError as exc:
        logger.warning("Не удалось отправить уведомление боту (%s): %s", path, exc)


def _as_max_user_id(max_user_id: str | None) -> int | None:
    """max_user_id хранит либо реальный числовой MAX id, либо dev-слаг
    (emp-marina) — уведомление физически некуда слать во втором случае."""
    if max_user_id is None:
        return None
    try:
        return int(max_user_id)
    except ValueError:
        return None


def notify_leave_request_submitted(
    *,
    manager_max_user_id: str | None,
    request_id: str,
    employee_full_name: str,
    employee_position: str,
    location_name: str | None,
    start_date: str,
    end_date: str,
    calendar_days: int,
    verdict_level: str,
    pay_deadline: str,
) -> None:
    manager_user_id = _as_max_user_id(manager_max_user_id)
    if manager_user_id is None:
        logger.info("Руководитель без числового max_user_id — уведомление о заявке %s пропущено", request_id)
        return
    _post(
        "/internal/notify/leave-request-submitted",
        {
            "manager_user_id": manager_user_id,
            "request_id": request_id,
            "employee_full_name": employee_full_name,
            "employee_position": employee_position,
            "location_name": location_name,
            "start_date": start_date,
            "end_date": end_date,
            "calendar_days": calendar_days,
            "verdict_level": verdict_level,
            "pay_deadline": pay_deadline,
        },
    )


def notify_leave_request_decided(
    *,
    employee_max_user_id: str | None,
    request_id: str,
    status: str,
    start_date: str,
    end_date: str,
    reject_reason: str | None = None,
) -> None:
    """README §2 сценарии 5-6: «уведомление сотруднику (вне API)» после
    approve/reject — было документировано, но не подключено нигде."""
    employee_user_id = _as_max_user_id(employee_max_user_id)
    if employee_user_id is None:
        logger.info("Сотрудник без числового max_user_id — уведомление о решении %s пропущено", request_id)
        return
    _post(
        "/internal/notify/leave-request-decided",
        {
            "employee_user_id": employee_user_id,
            "request_id": request_id,
            "status": status,
            "start_date": start_date,
            "end_date": end_date,
            "reject_reason": reject_reason,
        },
    )


def notify_employee_leave_reminder(
    *, employee_max_user_id: str | None, request_id: str, start_date: str, end_date: str
) -> None:
    """README §9 №13: «за 14 дней — известить работника» — планировщик
    (scheduler.py) вызывает это по notify_deadline согласованной заявки."""
    employee_user_id = _as_max_user_id(employee_max_user_id)
    if employee_user_id is None:
        logger.info("Сотрудник без числового max_user_id — напоминание по заявке %s пропущено", request_id)
        return
    _post(
        "/internal/notify/employee-leave-reminder",
        {
            "employee_user_id": employee_user_id,
            "request_id": request_id,
            "start_date": start_date,
            "end_date": end_date,
        },
    )


def notify_accountant_pay_reminder(
    *,
    accountant_max_user_id: str | None,
    request_id: str,
    employee_full_name: str,
    pay_deadline: str,
) -> None:
    """README §9 №13: «за 3 дня — выплатить отпускные»."""
    accountant_user_id = _as_max_user_id(accountant_max_user_id)
    if accountant_user_id is None:
        logger.info("Бухгалтер без числового max_user_id — напоминание по заявке %s пропущено", request_id)
        return
    _post(
        "/internal/notify/accountant-pay-reminder",
        {
            "accountant_user_id": accountant_user_id,
            "request_id": request_id,
            "employee_full_name": employee_full_name,
            "pay_deadline": pay_deadline,
        },
    )


def notify_manager_escalation(
    *,
    manager_max_user_id: str | None,
    request_id: str,
    employee_full_name: str,
    notify_deadline: str,
) -> None:
    """Не заявка README дословно, а прямое следствие ст. 123 ТК РФ +
    движка правил: заявка ещё pending, а срок извещения работника (ст. 123)
    подходит — руководителю нужно решить, иначе компания рискует штрафом."""
    manager_user_id = _as_max_user_id(manager_max_user_id)
    if manager_user_id is None:
        logger.info("Руководитель без числового max_user_id — эскалация по заявке %s пропущена", request_id)
        return
    _post(
        "/internal/notify/manager-escalation",
        {
            "manager_user_id": manager_user_id,
            "request_id": request_id,
            "employee_full_name": employee_full_name,
            "notify_deadline": notify_deadline,
        },
    )


def notify_employee_welcome_back(*, employee_max_user_id: str | None, request_id: str) -> None:
    """README §9 №13: «в день выхода — закрыть» — заявка закрывается
    планировщиком (scheduler.py) на следующий день после end_date."""
    employee_user_id = _as_max_user_id(employee_max_user_id)
    if employee_user_id is None:
        return
    _post(
        "/internal/notify/employee-welcome-back",
        {"employee_user_id": employee_user_id, "request_id": request_id},
    )


def notify_shift_offer_proposed(
    *,
    candidate_max_user_id: str | None,
    offer_id: str,
    location_name: str | None,
    score: float,
    reasons: list[str],
) -> None:
    candidate_user_id = _as_max_user_id(candidate_max_user_id)
    if candidate_user_id is None:
        logger.info("Кандидат без числового max_user_id — уведомление о предложении %s пропущено", offer_id)
        return
    _post(
        "/internal/notify/shift-offer-proposed",
        {
            "candidate_user_id": candidate_user_id,
            "offer_id": offer_id,
            "location_name": location_name,
            "score": score,
            "reasons": reasons,
        },
    )
