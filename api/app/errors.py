from __future__ import annotations

from fastapi import Request
from fastapi.responses import JSONResponse

from .schemas import ErrorBody, ErrorCode, ErrorDetail, ErrorResponse


class AppError(Exception):
    """Единая форма ошибки контракта: {error: {code, message, details}} (СМЕНА API §5)."""

    def __init__(
        self,
        status_code: int,
        code: ErrorCode,
        message: str,
        details: list[ErrorDetail] | None = None,
    ) -> None:
        self.status_code = status_code
        self.code = code
        self.message = message
        self.details = details or []


def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    body = ErrorResponse(error=ErrorBody(code=exc.code, message=exc.message, details=exc.details))
    return JSONResponse(status_code=exc.status_code, content=body.model_dump(mode="json", by_alias=True))


def not_linked() -> AppError:
    return AppError(403, ErrorCode.NOT_LINKED, "Сотрудник не найден. Пройдите подключение к компании")


def forbidden(message: str = "Действие недоступно для вашей роли") -> AppError:
    return AppError(403, ErrorCode.FORBIDDEN, message)


def not_found(message: str = "Объект не найден") -> AppError:
    return AppError(404, ErrorCode.NOT_FOUND, message)


def validation_error(message: str, details: list[ErrorDetail] | None = None) -> AppError:
    return AppError(400, ErrorCode.VALIDATION_ERROR, message, details)


def unauthorized(message: str = "initData не прошла проверку подписи") -> AppError:
    return AppError(401, ErrorCode.VALIDATION_ERROR, message)


def rule_violation(message: str) -> AppError:
    return AppError(422, ErrorCode.RULE_VIOLATION, message)


def already_resolved(message: str) -> AppError:
    return AppError(409, ErrorCode.ALREADY_RESOLVED, message)


def conflict(message: str) -> AppError:
    return AppError(409, ErrorCode.CONFLICT, message)
