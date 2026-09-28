from __future__ import annotations

import hashlib
import hmac
import uuid
from urllib.parse import parse_qsl

from fastapi import Depends, Header
from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import settings
from .db import get_db
from .db_models import Employee
from .errors import forbidden, not_linked, unauthorized, validation_error


def _verify_init_data(init_data: str) -> str:
    """Проверяет подпись `WebApp.initData` из MAX Bridge и возвращает max_user_id.

    openapi.yaml (securitySchemes.MaxInitData) описывает схему только словами —
    HMAC-SHA256 подписью токеном бота, без точного формата полей. Ниже —
    общепринятая для Bridge-подобных initData схема (аналог Telegram WebApp:
    HMAC-SHA256 по отсортированным `key=value`, секрет = HMAC(bot_token,
    "WebAppData")). Перед продакшеном сверить с dev.max.ru — доступ к этой
    документации не подтверждён на момент написания.
    """
    try:
        pairs = dict(parse_qsl(init_data, strict_parsing=True))
    except ValueError:
        raise unauthorized() from None

    received_hash = pairs.pop("hash", None)
    if not received_hash:
        raise unauthorized()

    check_string = "\n".join(f"{key}={value}" for key, value in sorted(pairs.items()))
    secret_key = hmac.new(b"WebAppData", settings.bot_token.encode("utf-8"), hashlib.sha256).digest()
    expected_hash = hmac.new(secret_key, check_string.encode("utf-8"), hashlib.sha256).hexdigest()

    if not hmac.compare_digest(expected_hash, received_hash):
        raise unauthorized()

    max_user_id = pairs.get("user_id") or pairs.get("id")
    if not max_user_id:
        raise unauthorized("initData не содержит идентификатор пользователя")
    return max_user_id


def get_current_employee(
    x_max_init_data: str | None = Header(default=None, alias="X-Max-Init-Data"),
    x_debug_employee_id: str | None = Header(default=None, alias="X-Debug-Employee-Id"),
    db: Session = Depends(get_db),
) -> Employee:
    if settings.auth_mode == "dev" and x_debug_employee_id:
        try:
            employee_id = uuid.UUID(x_debug_employee_id)
        except ValueError:
            raise validation_error("X-Debug-Employee-Id должен быть UUID") from None
        employee = db.get(Employee, employee_id)
        if employee is None:
            raise not_linked()
        return employee

    if not x_max_init_data:
        raise validation_error("Заголовок X-Max-Init-Data обязателен")

    max_user_id = _verify_init_data(x_max_init_data)
    employee = db.execute(select(Employee).where(Employee.max_user_id == max_user_id)).scalar_one_or_none()
    if employee is None:
        raise not_linked()
    return employee


def require_role(*roles: str):
    def dependency(employee: Employee = Depends(get_current_employee)) -> Employee:
        if not set(employee.roles) & set(roles):
            raise forbidden()
        return employee

    return dependency
