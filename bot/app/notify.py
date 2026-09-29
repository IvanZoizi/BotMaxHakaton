from __future__ import annotations

import logging

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from .bot_instance import bot
from .config import settings
from .keyboards import REJECT_REASON_LABELS, approval_card_keyboard, shift_offer_keyboard

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/internal", tags=["internal"])


def _check_secret(x_internal_secret: str | None) -> None:
    if x_internal_secret != settings.internal_notify_secret:
        logger.warning("Отклонён запрос к /internal/notify: неверный секрет")
        raise HTTPException(status_code=403, detail="Неверный секрет")


class LeaveRequestSubmittedNotification(BaseModel):
    """Backend вызывает это после `POST /leave-requests` (контракт §2,
    сценарий 4: «worker шлёт карточку руководителю в чат (вне этого API)»)
    — см. api/app/notify_client.py и routers/leave_requests.py."""

    manager_user_id: int  # числовой MAX user_id, не max_user_id-слаг из dev-режима
    request_id: str
    employee_full_name: str
    employee_position: str
    location_name: str | None = None
    start_date: str
    end_date: str
    calendar_days: int
    verdict_level: str
    pay_deadline: str


class LeaveRequestDecidedNotification(BaseModel):
    """README §2 сценарии 5-6: «уведомление сотруднику (вне этого API)»
    после approve/reject — см. routers/leave_requests.py на стороне api."""

    employee_user_id: int
    request_id: str
    status: str  # "approved" | "rejected"
    start_date: str
    end_date: str
    reject_reason: str | None = None


class LeaveRequestCancelledNotification(BaseModel):
    """№25/№7: сотрудник отозвал уже согласованный отпуск — см. api/app/routers/leave_requests.py."""

    manager_user_id: int
    request_id: str
    employee_full_name: str
    start_date: str
    end_date: str


class ShiftOfferDeclinedNotification(BaseModel):
    """GAP-05 — см. api/app/routers/shifts.py decline_shift_offer."""

    manager_user_id: int
    offer_id: str
    candidate_full_name: str


class EmployeeLeaveReminderNotification(BaseModel):
    """README §9 №13: «за 14 дней — известить работника»."""

    employee_user_id: int
    request_id: str
    start_date: str
    end_date: str


class AccountantPayReminderNotification(BaseModel):
    """README §9 №13: «за 3 дня — выплатить отпускные»."""

    accountant_user_id: int
    request_id: str
    employee_full_name: str
    pay_deadline: str


class ManagerEscalationNotification(BaseModel):
    """Заявка ещё pending, а срок извещения по ст. 123 ТК РФ подходит —
    см. api/app/scheduler.py."""

    manager_user_id: int
    request_id: str
    employee_full_name: str
    notify_deadline: str


class EmployeeWelcomeBackNotification(BaseModel):
    """README §9 №13: «в день выхода — закрыть»."""

    employee_user_id: int
    request_id: str


class ShiftOfferProposedNotification(BaseModel):
    """После `POST /shift-offers` — README §7 шаг 6: «бот шлёт кандидату
    сообщение с deeplink off_<offerId>»."""

    candidate_user_id: int
    offer_id: str
    location_name: str | None = None
    score: float
    reasons: list[str] = []


@router.get("/notify/health")
async def notify_health() -> dict[str, str]:
    return {"status": "ok"}


@router.post("/notify/leave-request-submitted")
async def notify_leave_request_submitted(
    payload: LeaveRequestSubmittedNotification,
    x_internal_secret: str | None = Header(default=None),
) -> dict[str, str]:
    _check_secret(x_internal_secret)
    logger.info(
        "Уведомление: заявка %s от %s -> менеджеру %s",
        payload.request_id,
        payload.employee_full_name,
        payload.manager_user_id,
    )

    location = f" · {payload.location_name}" if payload.location_name else ""
    text = (
        "🗓 Новая заявка на отпуск\n"
        f"{payload.employee_full_name} · {payload.employee_position}{location}\n"
        f"{payload.start_date} — {payload.end_date} ({payload.calendar_days} дн.)\n"
        f"Отпускные выплатить до {payload.pay_deadline}"
    )

    await bot.send_message(
        user_id=payload.manager_user_id,
        text=text,
        attachments=approval_card_keyboard(payload.request_id),
    )
    return {"status": "sent"}


@router.post("/notify/leave-request-decided")
async def notify_leave_request_decided(
    payload: LeaveRequestDecidedNotification,
    x_internal_secret: str | None = Header(default=None),
) -> dict[str, str]:
    _check_secret(x_internal_secret)
    logger.info("Уведомление: решение по заявке %s -> сотруднику %s (%s)", payload.request_id, payload.employee_user_id, payload.status)

    if payload.status == "approved":
        text = f"✅ Отпуск {payload.start_date} — {payload.end_date} согласован."
    else:
        # reject_reason — код ("high_load") для предустановленных причин или
        # уже готовый текст для "другое" (см. api/app/routers/leave_requests.py
        # reject_leave_request: reason_text or reason_code.value). Раньше сюда
        # всегда попадал сырой код без перевода.
        reason_label = REJECT_REASON_LABELS.get(payload.reject_reason or "", payload.reject_reason)
        reason = f"\nПричина: {reason_label}" if reason_label else ""
        text = f"❌ Отпуск {payload.start_date} — {payload.end_date} отклонён.{reason}"

    await bot.send_message(user_id=payload.employee_user_id, text=text)
    return {"status": "sent"}


@router.post("/notify/leave-request-cancelled")
async def notify_leave_request_cancelled(
    payload: LeaveRequestCancelledNotification,
    x_internal_secret: str | None = Header(default=None),
) -> dict[str, str]:
    _check_secret(x_internal_secret)
    logger.info("Уведомление: отзыв заявки %s -> руководителю %s", payload.request_id, payload.manager_user_id)

    text = f"↩️ {payload.employee_full_name} отозвал(а) отпуск {payload.start_date} — {payload.end_date}."
    await bot.send_message(user_id=payload.manager_user_id, text=text)
    return {"status": "sent"}


@router.post("/notify/shift-offer-declined")
async def notify_shift_offer_declined(
    payload: ShiftOfferDeclinedNotification,
    x_internal_secret: str | None = Header(default=None),
) -> dict[str, str]:
    _check_secret(x_internal_secret)
    logger.info("Уведомление: отказ от предложения %s -> руководителю %s", payload.offer_id, payload.manager_user_id)

    text = f"⚠️ {payload.candidate_full_name} не сможет выйти на смену. Подберите другого кандидата."
    await bot.send_message(user_id=payload.manager_user_id, text=text)
    return {"status": "sent"}


@router.post("/notify/employee-leave-reminder")
async def notify_employee_leave_reminder(
    payload: EmployeeLeaveReminderNotification,
    x_internal_secret: str | None = Header(default=None),
) -> dict[str, str]:
    _check_secret(x_internal_secret)
    logger.info("Уведомление: напоминание об отпуске %s -> сотруднику %s", payload.request_id, payload.employee_user_id)

    text = f"⏰ Скоро отпуск: {payload.start_date} — {payload.end_date}."
    await bot.send_message(user_id=payload.employee_user_id, text=text)
    return {"status": "sent"}


@router.post("/notify/accountant-pay-reminder")
async def notify_accountant_pay_reminder(
    payload: AccountantPayReminderNotification,
    x_internal_secret: str | None = Header(default=None),
) -> dict[str, str]:
    _check_secret(x_internal_secret)
    logger.info("Уведомление: напоминание о выплате по заявке %s -> бухгалтеру %s", payload.request_id, payload.accountant_user_id)

    text = f"💰 Отпускные для {payload.employee_full_name} — выплатить не позднее {payload.pay_deadline}."
    await bot.send_message(user_id=payload.accountant_user_id, text=text)
    return {"status": "sent"}


@router.post("/notify/manager-escalation")
async def notify_manager_escalation(
    payload: ManagerEscalationNotification,
    x_internal_secret: str | None = Header(default=None),
) -> dict[str, str]:
    _check_secret(x_internal_secret)
    logger.info("Уведомление: эскалация по заявке %s -> руководителю %s", payload.request_id, payload.manager_user_id)

    text = (
        f"⚠️ Заявка {payload.employee_full_name} всё ещё без решения, а известить "
        f"сотрудника нужно до {payload.notify_deadline} (ст. 123 ТК РФ). Решите как можно скорее."
    )
    await bot.send_message(user_id=payload.manager_user_id, text=text)
    return {"status": "sent"}


@router.post("/notify/employee-welcome-back")
async def notify_employee_welcome_back(
    payload: EmployeeWelcomeBackNotification,
    x_internal_secret: str | None = Header(default=None),
) -> dict[str, str]:
    _check_secret(x_internal_secret)
    logger.info("Уведомление: возвращение из отпуска по заявке %s -> сотруднику %s", payload.request_id, payload.employee_user_id)

    await bot.send_message(user_id=payload.employee_user_id, text="👋 С возвращением! Хорошей смены.")
    return {"status": "sent"}


@router.post("/notify/shift-offer-proposed")
async def notify_shift_offer_proposed(
    payload: ShiftOfferProposedNotification,
    x_internal_secret: str | None = Header(default=None),
) -> dict[str, str]:
    _check_secret(x_internal_secret)
    logger.info(
        "Уведомление: предложение смены %s -> кандидату %s",
        payload.offer_id,
        payload.candidate_user_id,
    )

    location = f" в {payload.location_name}" if payload.location_name else ""
    reasons = "\n".join(f"· {r}" for r in payload.reasons)
    text = f"💼 Есть подработка{location}\n{reasons}".strip()

    await bot.send_message(
        user_id=payload.candidate_user_id,
        text=text,
        attachments=shift_offer_keyboard(payload.offer_id),
    )
    return {"status": "sent"}
