from __future__ import annotations

import logging

from maxapi import F, Router
from maxapi.filters.command import CommandStart
from maxapi.types.updates.bot_started import BotStarted
from maxapi.types.updates.message_created import MessageCreated

from ..api_client import ApiError, get_shift_offer, link_employee
from ..bot_instance import bot
from ..deeplinks import JoinDeepLink, ShiftOfferDeepLink, parse_deep_link
from ..keyboards import open_miniapp_button, shift_offer_keyboard

logger = logging.getLogger(__name__)
start_router = Router(router_id="start")

WELCOME_TEXT = (
    "Привет! Это бот «Смена» — отпуска и подмены прямо в MAX.\n"
    "Откройте приложение, чтобы оформить отпуск или посмотреть заявки."
)

NOT_LINKED_TEXT = (
    "Вы ещё не подключены к компании как сотрудник. "
    "Обратитесь к своему руководителю или администратору."
)


async def _handle_entry(*, chat_id: int, max_user_id: str, payload: str | None) -> None:
    """Общая точка входа и для BotStarted (первый запуск), и для
    /start <payload> (пользователь уже писал боту раньше) — deep link должен
    работать одинаково в обоих случаях."""
    link = parse_deep_link(payload)
    logger.info("Вход в бота: chat_id=%s max_user_id=%s deep_link=%r", chat_id, max_user_id, link)

    if link is None:
        await bot.send_message(chat_id=chat_id, text=WELCOME_TEXT, attachments=[open_miniapp_button()])
        return

    if isinstance(link, JoinDeepLink):
        await _link_employee(chat_id=chat_id, max_user_id=max_user_id, invite_code=link.code)
        return

    if isinstance(link, ShiftOfferDeepLink):
        await _send_shift_offer(chat_id=chat_id, offer_id=link.offer_id, max_user_id=max_user_id)
        return


async def _link_employee(*, chat_id: int, max_user_id: str, invite_code: str) -> None:
    """Персональная ссылка от руководителя (README/контракт §2 сценарий 1;
    создаётся через /add_employee — см. routers/employee_admin.py)."""
    try:
        me = await link_employee(invite_code, max_user_id)
    except ApiError as exc:
        logger.warning("Не удалось привязать сотрудника (код %s): %s", invite_code, exc)
        if exc.code == "NOT_FOUND":
            text = "Код приглашения не найден. Проверьте ссылку или обратитесь к руководителю."
        elif exc.code == "ALREADY_RESOLVED":
            text = "Эта ссылка уже использована. Обратитесь к руководителю за новой."
        elif exc.code == "CONFLICT":
            text = "Этот профиль MAX уже привязан к другому сотруднику."
        else:
            text = f"Не удалось подключиться: {exc.message}"
        await bot.send_message(chat_id=chat_id, text=text)
        return

    logger.info("Сотрудник привязан: max_user_id=%s -> %s", max_user_id, me.get("id"))
    await bot.send_message(
        chat_id=chat_id,
        text=f"Готово! Вы подключены как {me.get('fullName')} ({me.get('position')}).",
        attachments=[open_miniapp_button()],
    )


async def _send_shift_offer(*, chat_id: int, offer_id: str, max_user_id: str) -> None:
    try:
        offer = await get_shift_offer(offer_id, acting_max_user_id=max_user_id)
    except ApiError as exc:
        logger.warning("Не удалось получить предложение смены %s: %s", offer_id, exc)
        text = NOT_LINKED_TEXT if exc.code == "NOT_LINKED" else f"Не удалось открыть предложение: {exc.message}"
        await bot.send_message(chat_id=chat_id, text=text)
        return

    reasons = "\n".join(f"· {r}" for r in offer.get("reasons", []))
    text = f"Предложение подработки (score {offer.get('score')})\n{reasons}".strip()
    await bot.send_message(chat_id=chat_id, text=text, attachments=shift_offer_keyboard(offer_id))


@start_router.bot_started(F.payload)
async def on_started_with_payload(event: BotStarted) -> None:
    """Первый запуск бота по deep link (join_<code> / off_<id>)."""
    await _handle_entry(chat_id=event.chat_id, max_user_id=str(event.user.user_id), payload=event.payload)


@start_router.bot_started()
async def on_started_plain(event: BotStarted) -> None:
    """Первый запуск без deep link — обычное нажатие «Начать»."""
    logger.info("Первый запуск бота: chat_id=%s user_id=%s", event.chat_id, event.user.user_id)
    await bot.send_message(chat_id=event.chat_id, text=WELCOME_TEXT, attachments=[open_miniapp_button()])


@start_router.message_created(CommandStart())
async def on_start_command(event: MessageCreated, args: list[str]) -> None:
    """/start <payload> — тот же deep link, но когда пользователь уже
    писал боту раньше (BotStarted для него больше не сработает)."""
    chat_id = event.message.recipient.chat_id
    user = event.message.sender
    if chat_id is None or user is None:
        logger.warning("Команда /start без chat_id/sender — игнорирую")
        return
    payload = args[0] if args else None
    await _handle_entry(chat_id=chat_id, max_user_id=str(user.user_id), payload=payload)
