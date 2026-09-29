from __future__ import annotations

import logging
import sys

_FORMAT = "%(asctime)s %(levelname)-8s %(name)s: %(message)s"


def configure_logging(level: str = "INFO") -> None:
    """Без этого logger.info()/logger.debug() по всему сервису (notify_client,
    scheduler, ...) молча проглатываются — Python по умолчанию показывает
    только WARNING и выше через 'handler of last resort'. Тот же паттерн,
    что в bot/app/logging_config.py — единое форматирование, один поток
    вывода (stdout, как ожидает docker logs)."""
    root = logging.getLogger()
    root.setLevel(level.upper())

    if root.handlers:
        return

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter(_FORMAT, datefmt="%Y-%m-%d %H:%M:%S"))
    root.addHandler(handler)

    # fpdf2 использует fontTools для субсеттинга шрифта при каждой генерации
    # PDF (approve → Заявление + Т-6) — на INFO это построчный отчёт по
    # каждой урезанной таблице шрифта, шумит сильнее самого приложения.
    logging.getLogger("fontTools").setLevel(logging.WARNING)
