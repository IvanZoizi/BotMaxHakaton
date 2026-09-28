from __future__ import annotations

import uuid

from .errors import not_found


def parse_uuid_or_404(value: str, message: str = "Объект не найден") -> uuid.UUID:
    try:
        return uuid.UUID(value)
    except ValueError:
        raise not_found(message) from None
