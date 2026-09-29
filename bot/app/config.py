from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # maxapi.Bot() ищет именно эту переменную окружения по умолчанию — имя
    # поля здесь совпадает намеренно, чтобы был один источник правды.
    max_bot_token: str = ""

    # Куда бот ходит за данными и действиями (approve/reject/accept) — тот же
    # backend, что и у мини-аппа (api/app).
    api_base_url: str = "http://api:8000"
    # Совпадает с api/app/config.py AUTH_MODE=dev: бот, действуя от имени
    # сотрудника, шлёт X-Debug-Employee-Id вместо реальной подписи initData.
    # См. предупреждение в api/app/auth.py — то же самое относится и сюда.
    api_auth_mode: str = "dev"

    # Вебхук — тот же паттерн, что и остальные сервисы за общим nginx
    # (см. корневой nginx.config: /bot/ -> bot:8080).
    webhook_url: str = ""
    webhook_secret: str | None = None
    webhook_host: str = "0.0.0.0"
    webhook_port: int = 8080
    webhook_path: str = "/webhook"

    # Секрет для POST /internal/notify/* — backend дёргает бота, чтобы
    # отправить карточку/уведомление; общий секрет, не публичный эндпоинт.
    internal_notify_secret: str = "dev-notify-secret"

    # Мини-апп открывается кнопкой OpenAppButton по username бота, но домен
    # пилота ещё не известен — используется как fallback для LinkButton, если
    # OpenAppButton недоступен на площадке.
    miniapp_url: str = "https://smena.example.com"

    log_level: str = "INFO"


settings = Settings()
