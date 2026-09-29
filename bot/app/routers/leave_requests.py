from __future__ import annotations

import logging

from maxapi import Router
from maxapi.types.updates.message_callback import MessageCallback

from ..api_client import ApiError, reject_leave_request
from ..keyboards import reject_reason_keyboard
from ..payloads import RejectLeaveRequestPayload, RejectLeaveRequestPromptPayload

logger = logging.getLogger(__name__)
leave_requests_router = Router(router_id="leave_requests")

# Согласование больше не живёт в этом роутере — «Согласовать» на карточке
# (keyboards.approval_card_keyboard) ведёт deeplink'ом в мини-апп, где
# подтверждение биометрией. См. диаграмму онбординга, раздел 3.


@leave_requests_router.message_callback(RejectLeaveRequestPromptPayload.filter())
async def on_reject_prompt(event: MessageCallback, payload: RejectLeaveRequestPromptPayload) -> None:
    logger.info("Запрошена причина отказа для заявки %s", payload.request_id)
    await event.edit(
        text="Причина отказа:",
        attachments=reject_reason_keyboard(payload.request_id),
    )


@leave_requests_router.message_callback(RejectLeaveRequestPayload.filter())
async def on_reject(event: MessageCallback, payload: RejectLeaveRequestPayload) -> None:
    max_user_id = str(event.callback.user.user_id)
    logger.info(
        "Отклонение заявки %s пользователем %s, причина=%s",
        payload.request_id,
        max_user_id,
        payload.reason_code,
    )
    try:
        await reject_leave_request(
            payload.request_id, reason_code=payload.reason_code, acting_max_user_id=max_user_id
        )
    except ApiError as exc:
        logger.warning("Не удалось отклонить заявку %s: %s", payload.request_id, exc)
        await event.answer(notification=f"Не удалось отклонить: {exc.message}")
        return

    await event.edit(text="❌ Заявка отклонена.", attachments=[])
