from __future__ import annotations

import logging

from maxapi import Router
from maxapi.filters.command import Command
from maxapi.types.updates.message_created import MessageCreated

from ..api_client import ApiError, approve_schedule_t7, list_employees
from ..bot_instance import bot
from ..deeplinks import build_schedule_t7_payload
from ..keyboards import open_miniapp_keyboard

logger = logging.getLogger(__name__)
schedule_t7_router = Router(router_id="schedule_t7")


def _parse_year(text: str | None) -> int | None:
    _, _, remainder = (text or "").partition(" ")
    remainder = remainder.strip()
    return int(remainder) if remainder.isdigit() else None


@schedule_t7_router.message_created(Command("collect_schedule"))
async def on_collect_schedule(event: MessageCreated) -> None:
    """№24: руководитель запускает сбор графика Т-7 на год — каждому
    сотруднику его точки уходит приглашение открыть мини-апп и указать даты.

    commands_info: Собрать график отпусков на год (для руководителя)
    """
    user = event.message.sender
    if user is None:
        return
    max_user_id = str(user.user_id)
    year = _parse_year(event.message.body.text if event.message.body else None)
    if year is None:
        await event.message.answer("Формат: /collect_schedule 2027")
        return

    try:
        employees = await list_employees(acting_max_user_id=max_user_id)
    except ApiError as exc:
        logger.warning("Не удалось получить список сотрудников: %s", exc)
        await event.message.answer(f"Не удалось запустить сбор графика: {exc.message}")
        return

    sent = 0
    for emp in employees:
        emp_max_user_id = emp.get("maxUserId") or emp.get("max_user_id")
        if emp_max_user_id == max_user_id:
            continue  # сам руководитель — ему отдельное сообщение со ссылкой на обзор, не на форму
        try:
            emp_user_id = int(emp_max_user_id)
        except (TypeError, ValueError):
            continue  # ещё не привязан к MAX — пригласить некуда
        await bot.send_message(
            user_id=emp_user_id,
            text=f"📅 Собираем график отпусков на {year} год — укажите желаемые даты.",
            attachments=open_miniapp_keyboard(
                "Указать даты", payload=build_schedule_t7_payload(year)
            ),
        )
        sent += 1

    await bot.send_message(
        user_id=int(max_user_id),
        text=f"Приглашение на {year} год получили {sent} сотрудников. Ответы и утверждение — здесь же.",
        attachments=open_miniapp_keyboard("Смотреть ответы", payload=build_schedule_t7_payload(year)),
    )


@schedule_t7_router.message_created(Command("approve_schedule"))
async def on_approve_schedule(event: MessageCreated) -> None:
    """commands_info: Утвердить график отпусков (для руководителя)"""
    user = event.message.sender
    if user is None:
        return
    max_user_id = str(user.user_id)
    year = _parse_year(event.message.body.text if event.message.body else None)
    if year is None:
        await event.message.answer("Формат: /approve_schedule 2027")
        return

    try:
        entries = await approve_schedule_t7(year, acting_max_user_id=max_user_id)
    except ApiError as exc:
        logger.warning("Не удалось утвердить график %s: %s", year, exc)
        await event.message.answer(f"Не удалось утвердить график: {exc.message}")
        return

    conflicts = [e for e in entries if e.get("conflictsWith")]
    text = f"✅ График на {year} год утверждён — {len(entries)} записей."
    if conflicts:
        text += f"\n⚠️ Пересечения дат у {len(conflicts)} сотрудников — проверьте в приложении."
    await event.message.answer(text)
