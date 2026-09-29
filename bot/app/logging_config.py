from __future__ import annotations

import logging
import sys

from .config import settings

_FORMAT = "%(asctime)s %(levelname)-8s %(name)s: %(message)s"


def configure_logging() -> None:
    """Единая настройка логирования — вызывается один раз при старте.

    Настраивает корневой логгер, поэтому под неё автоматически попадают и
    логгеры maxapi (bot/connection/dispatcher из maxapi/loggers.py), и наши
    собственные (везде logging.getLogger(__name__)) — единый формат, один
    поток вывода (stdout, как обычно ожидает docker logs).
    """
    root = logging.getLogger()
    root.setLevel(settings.log_level.upper())

    if root.handlers:
        # Повторный вызов (например, из тестов) — не плодим дубликаты.
        return

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter(_FORMAT, datefmt="%Y-%m-%d %H:%M:%S"))
    root.addHandler(handler)

    # aiohttp по умолчанию логирует access-строки на уровне INFO для каждого
    # запроса к MAX API — шумно при обычной отладке, оставляем WARNING.
    logging.getLogger("aiohttp.access").setLevel(logging.WARNING)
