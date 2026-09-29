from __future__ import annotations

from maxapi.types.attachments.buttons.callback_button import CallbackButton
from maxapi.types.attachments.buttons.link_button import LinkButton
from maxapi.types.attachments.buttons.open_app_button import OpenAppButton
from maxapi.utils.inline_keyboard import InlineKeyboardBuilder

from .bot_instance import bot
from .config import settings
from .payloads import AcceptShiftOfferPayload, RejectLeaveRequestPayload, RejectLeaveRequestPromptPayload

REJECT_REASON_LABELS: dict[str, str] = {
    "team_overlap": "Пересекается с отпуском коллеги",
    "high_load": "Высокая загрузка",
}


def open_miniapp_button(text: str = "Открыть приложение", payload: str | None = None) -> CallbackButton | LinkButton | OpenAppButton:
    """№39 из README §9 (deeplink прямо на карточку заявки): OpenAppButton
    запускает мини-апп внутри MAX с payload в initData. Если бот ещё не
    получил свой username (bot.me не заполнен — get_me() не выполнялся),
    откатываемся на обычную ссылку, чтобы кнопка не падала с ошибкой."""
    username = bot.me.username if bot.me else None
    if username:
        return OpenAppButton(text=text, web_app=username, payload=payload)
    return LinkButton(text=text, url=settings.miniapp_url)


def approval_card_keyboard(request_id: str) -> list:
    """Диаграмма онбординга/раздел 3: «Согласовать» ведёт в мини-апп на
    биометрическое подтверждение — BiometricManager доступен только там, не
    в чате бота (README §7 шаг 4, §10). Прямого approve из чата больше нет:
    «Отклонить» — единственное действие, которое остаётся нативным в боте,
    т.к. не требует подписи."""
    kb = InlineKeyboardBuilder()
    kb.row(open_miniapp_button("✅ Открыть и согласовать", payload=f"requestId={request_id}"))
    kb.row(CallbackButton(text="❌ Отклонить", payload=RejectLeaveRequestPromptPayload(request_id=request_id).pack()))
    return [kb.as_markup()]


def reject_reason_keyboard(request_id: str) -> list:
    kb = InlineKeyboardBuilder()
    for reason_code, label in REJECT_REASON_LABELS.items():
        kb.row(
            CallbackButton(
                text=label,
                payload=RejectLeaveRequestPayload(request_id=request_id, reason_code=reason_code).pack(),
            )
        )
    return [kb.as_markup()]


def shift_offer_keyboard(offer_id: str) -> list:
    kb = InlineKeyboardBuilder()
    kb.row(CallbackButton(text="Выйду", payload=AcceptShiftOfferPayload(offer_id=offer_id).pack()))
    return [kb.as_markup()]
