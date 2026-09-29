from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from maxapi.enums.update import UpdateType
from maxapi.webhook.fastapi import FastAPIMaxWebhook

from .api_client import close_session
from .bot_instance import bot, dp
from .config import settings
from .logging_config import configure_logging
from .notify import router as notify_router
from .routers.employee_admin import employee_admin_router
from .routers.leave_requests import leave_requests_router
from .routers.shift_offers import shift_offers_router
from .routers.start import start_router

configure_logging()
logger = logging.getLogger(__name__)

dp.include_routers(start_router, leave_requests_router, shift_offers_router, employee_admin_router)


@dp.on_started()
async def on_dispatcher_started() -> None:
    """Подписка на webhook при старте — аналог bot.subscribe_webhook() из
    примера 09_webhook_bot.py в maxapi, адаптированный под наш конфиг."""
    if not settings.webhook_url:
        logger.warning(
            "WEBHOOK_URL не задан — подписка на webhook пропущена "
            "(бот запущен, но MAX не будет слать ему обновления)"
        )
        return
    logger.info("Подписываюсь на webhook: %s", settings.webhook_url)
    try:
        await bot.subscribe_webhook(
            url=settings.webhook_url,
            update_types=[
                UpdateType.MESSAGE_CREATED,
                UpdateType.MESSAGE_CALLBACK,
                UpdateType.BOT_STARTED,
            ],
            secret=settings.webhook_secret,
        )
        logger.info("Подписка на webhook оформлена")
    except Exception:
        logger.exception("Не удалось подписаться на webhook")


def build_app() -> FastAPI:
    webhook = FastAPIMaxWebhook(dp=dp, bot=bot, secret=settings.webhook_secret)

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        async with webhook.lifespan(_):
            yield
        await close_session()
        logger.info("Сессия к backend API закрыта")

    app = FastAPI(title="СМЕНА Bot", lifespan=lifespan)
    webhook.setup(app, path=settings.webhook_path)
    app.include_router(notify_router)

    @app.get("/health")
    async def health() -> JSONResponse:
        return JSONResponse({"status": "ok"})

    return app


app = build_app()
