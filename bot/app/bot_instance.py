from __future__ import annotations

from maxapi import Bot, Dispatcher
from maxapi.client.default import DefaultConnectionProperties

from .config import settings

# Диспетчер вызывает bot.get_me() при старте (dp.startup -> check_me()), это
# блокирует запуск приложения до ответа MAX API. Библиотечный дефолт — 150с
# суммарного таймаута; с явно неверным/недостижимым токеном лучше падать
# быстро и понятно, чем зависать в "Waiting for application startup" без
# единой строки в логе (так и произошло при локальной проверке с
# MAX_BOT_TOKEN-заглушкой — см. итоговое сообщение в чате).
bot = Bot(
    token=settings.max_bot_token or None,
    default_connection=DefaultConnectionProperties(timeout=15, sock_connect=10),
)
dp = Dispatcher()
