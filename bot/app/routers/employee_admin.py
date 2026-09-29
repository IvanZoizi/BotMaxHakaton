from __future__ import annotations

import logging

from maxapi import Router
from maxapi.filters.command import Command
from maxapi.types.updates.message_created import MessageCreated
from maxapi.utils.deep_linking import create_start_link

from ..api_client import ApiError, create_employee
from ..bot_instance import bot
from ..deeplinks import build_join_payload

logger = logging.getLogger(__name__)
employee_admin_router = Router(router_id="employee_admin")

VALID_ROLES = {"employee", "manager", "accountant", "admin"}

USAGE_TEXT = (
    "Формат: /add_employee Фамилия Имя; Должность; роль\n"
    "Роль можно не указывать — по умолчанию employee "
    "(ещё бывают manager, accountant, admin).\n\n"
    "Например: /add_employee Кузнецов Артём; Продавец-кассир"
)


@employee_admin_router.message_created(Command("add_employee"))
async def on_add_employee(event: MessageCreated) -> None:
    """Руководитель создаёт запись сотрудника и получает персональную ссылку
    (README/контракт §2 сценарий 1: «который даёт руководитель»). Разбор по
    ';' — не по пробелу, т.к. ФИО и должность сами содержат пробелы.

    commands_info: Добавить сотрудника и получить ссылку-приглашение
    """
    chat_id = event.message.recipient.chat_id
    user = event.message.sender
    if chat_id is None or user is None:
        return

    text = event.message.body.text if event.message.body else ""
    _, _, remainder = (text or "").partition(" ")
    parts = [p.strip() for p in remainder.split(";")]

    if len(parts) < 2 or not parts[0] or not parts[1]:
        await event.message.answer(USAGE_TEXT)
        return

    full_name, position = parts[0], parts[1]
    role = parts[2] if len(parts) > 2 and parts[2] else "employee"
    if role not in VALID_ROLES:
        await event.message.answer(f"Такой роли нет: «{role}». Доступны: {', '.join(sorted(VALID_ROLES))}")
        return

    max_user_id = str(user.user_id)
    logger.info("Создание сотрудника %r (%s, %s) руководителем %s", full_name, position, role, max_user_id)

    try:
        created = await create_employee(full_name, position, role, acting_max_user_id=max_user_id)
    except ApiError as exc:
        logger.warning("Не удалось создать сотрудника: %s", exc)
        await event.message.answer(f"Не удалось добавить сотрудника: {exc.message}")
        return

    invite_code = created["inviteCode"]
    payload = build_join_payload(invite_code)
    username = bot.me.username if bot.me else None
    if not username:
        # bot.me обычно уже заполнен check_me() при старте (см. bot_instance.py),
        # но полагаться на это и молча слать нерабочий плейсхолдер вместо
        # ссылки — хуже, чем лишний вызов get_me(): без реального username
        # create_start_link выдать ссылку не может в принципе.
        try:
            username = (await bot.get_me()).username
        except Exception:
            logger.exception("Не удалось получить username бота для ссылки-приглашения")

    if username:
        link = create_start_link(username=username, payload=payload, encode=False)
    else:
        link = f"не удалось сформировать ссылку — передайте код вручную: {payload}"

    await event.message.answer(
        f"✅ {full_name} добавлен(а) — {position}.\n"
        f"Перешлите одноразовую ссылку, чтобы подключить:\n{link}"
    )
