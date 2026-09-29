from __future__ import annotations

import logging
from typing import Any

import aiohttp

from .config import settings

logger = logging.getLogger(__name__)

_session: aiohttp.ClientSession | None = None


class ApiError(Exception):
    """Ошибка контракта backend'а — {error: {code, message, details}} (СМЕНА API §5)."""

    def __init__(self, status: int, code: str, message: str) -> None:
        super().__init__(f"{code}: {message}")
        self.status = status
        self.code = code
        self.message = message


async def get_session() -> aiohttp.ClientSession:
    global _session
    if _session is None or _session.closed:
        _session = aiohttp.ClientSession(base_url=settings.api_base_url)
    return _session


async def close_session() -> None:
    global _session
    if _session is not None and not _session.closed:
        await _session.close()
    _session = None


async def _request(
    method: str,
    path: str,
    *,
    acting_max_user_id: str | None,
    json: dict[str, Any] | None = None,
    params: dict[str, Any] | None = None,
) -> Any:
    """Ходит в backend от имени конкретного MAX-пользователя.

    Бот почти никогда не действует "от своего имени" — согласование,
    отклонение, принятие смены всегда инициированы конкретным человеком в
    MAX, поэтому запрос к backend идёт с его identity — X-Debug-Employee-Id.
    X-Internal-Secret (тот же секрет, что и для api -> bot уведомлений,
    BOT_INTERNAL_NOTIFY_SECRET) — доказательство серверу, что этот заголовок
    прислал именно бот, а не кто угодно; без него api/app/auth.py принял бы
    X-Debug-Employee-Id только при AUTH_MODE=dev (см. комментарий там же).
    Исключение — POST /employees/link: вызывающий на этом шаге ещё не
    привязанный сотрудник, поэтому acting_max_user_id=None и заголовки не
    отправляются вовсе (см. api/app/routers/employees.py).
    """
    session = await get_session()
    headers = (
        {"X-Debug-Employee-Id": acting_max_user_id, "X-Internal-Secret": settings.internal_notify_secret}
        if acting_max_user_id is not None
        else {}
    )

    logger.info("-> %s %s (as %s)", method, path, acting_max_user_id or "unauthenticated")
    try:
        async with session.request(method, path, json=json, params=params, headers=headers) as resp:
            body = await resp.json(content_type=None) if resp.content_length else None
            if resp.status >= 400:
                error = (body or {}).get("error", {})
                code = error.get("code", "UNKNOWN")
                message = error.get("message", f"HTTP {resp.status}")
                logger.warning("<- %s %s: %s %s", method, path, resp.status, code)
                raise ApiError(resp.status, code, message)
            logger.info("<- %s %s: %s", method, path, resp.status)
            return body
    except aiohttp.ClientError:
        logger.exception("Сбой соединения с backend: %s %s", method, path)
        raise


async def get_leave_request(request_id: str, *, acting_max_user_id: str) -> dict[str, Any]:
    return await _request("GET", f"/leave-requests/{request_id}", acting_max_user_id=acting_max_user_id)


async def reject_leave_request(
    request_id: str,
    *,
    reason_code: str,
    acting_max_user_id: str,
    reason_text: str | None = None,
) -> dict[str, Any]:
    return await _request(
        "POST",
        f"/leave-requests/{request_id}/reject",
        json={"reasonCode": reason_code, "reasonText": reason_text},
        acting_max_user_id=acting_max_user_id,
    )


async def get_shift_offer(offer_id: str, *, acting_max_user_id: str) -> dict[str, Any]:
    return await _request("GET", f"/shift-offers/{offer_id}", acting_max_user_id=acting_max_user_id)


async def accept_shift_offer(offer_id: str, *, acting_max_user_id: str) -> dict[str, Any]:
    return await _request(
        "POST", f"/shift-offers/{offer_id}/accept", acting_max_user_id=acting_max_user_id
    )


async def create_employee(
    full_name: str, position: str, role: str, *, acting_max_user_id: str
) -> dict[str, Any]:
    return await _request(
        "POST",
        "/employees",
        json={"fullName": full_name, "position": position, "role": role},
        acting_max_user_id=acting_max_user_id,
    )


async def list_employees(*, acting_max_user_id: str) -> list[dict[str, Any]]:
    return await _request("GET", "/employees", acting_max_user_id=acting_max_user_id)


async def approve_schedule_t7(year: int, *, acting_max_user_id: str) -> list[dict[str, Any]]:
    return await _request(
        "POST", "/schedule-t7/approve", json={"year": year}, acting_max_user_id=acting_max_user_id
    )


async def link_employee(invite_code: str, max_user_id: str) -> dict[str, Any]:
    return await _request(
        "POST",
        "/employees/link",
        json={"inviteCode": invite_code, "maxUserId": max_user_id},
        acting_max_user_id=None,
    )
