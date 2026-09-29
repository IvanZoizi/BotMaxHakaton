from __future__ import annotations

from maxapi.filters.callback_payload import CallbackPayload


class RejectLeaveRequestPromptPayload(CallbackPayload, prefix="lr_rej_ask"):
    """Кнопка «Отклонить» на карточке — сперва просим причину (см. reject reasons ниже)."""

    request_id: str


class RejectLeaveRequestPayload(CallbackPayload, prefix="lr_rej"):
    """Быстрые причины — те же team_overlap/high_load, что в шторке мини-аппа
    (RejectReasonCode в openapi.yaml). Свободный текст ("other") — только в
    мини-аппе, у бота нет диалога для ввода текста в этом каркасе."""

    request_id: str
    reason_code: str


class AcceptShiftOfferPayload(CallbackPayload, prefix="so_accept"):
    offer_id: str
