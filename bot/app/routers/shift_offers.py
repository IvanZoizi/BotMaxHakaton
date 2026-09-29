from __future__ import annotations

import logging

from maxapi import Router
from maxapi.types.updates.message_callback import MessageCallback

from ..api_client import ApiError, accept_shift_offer
from ..payloads import AcceptShiftOfferPayload

logger = logging.getLogger(__name__)
shift_offers_router = Router(router_id="shift_offers")


@shift_offers_router.message_callback(AcceptShiftOfferPayload.filter())
async def on_accept(event: MessageCallback, payload: AcceptShiftOfferPayload) -> None:
    max_user_id = str(event.callback.user.user_id)
    logger.info("Принятие предложения смены %s пользователем %s", payload.offer_id, max_user_id)
    try:
        await accept_shift_offer(payload.offer_id, acting_max_user_id=max_user_id)
    except ApiError as exc:
        logger.warning("Не удалось принять предложение %s: %s", payload.offer_id, exc)
        await event.answer(notification=f"Не удалось принять: {exc.message}")
        return

    await event.edit(text="Вы вышли на смену. Спасибо!", attachments=[])
