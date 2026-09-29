from __future__ import annotations

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "postgresql+psycopg://smena:smena@localhost:5432/smena"
    auth_mode: str = "dev"  # "dev" допускает mock-initData через X-Debug-Employee-Id, см. openapi.yaml servers
    bot_token: str = "dev-bot-token"
    files_dir: Path = Path("./storage")
    file_url_ttl_seconds: int = 600
    file_signing_secret: str = "dev-file-secret"

    # Уведомления — api зовёт bot/app/notify.py (см. notify_client.py).
    # Пусто = уведомления просто пропускаются с предупреждением в лог,
    # чтобы локальная разработка без бота не ломалась.
    bot_base_url: str = ""
    bot_internal_notify_secret: str = "dev-notify-secret"
    # Как часто гонять scheduler.run_reminder_sweep (секунды). Раз в час
    # достаточно для реальных суточных дедлайнов; для демонстрации/проверки
    # можно поставить меньше через .env.
    reminder_sweep_interval_seconds: int = 3600


settings = Settings()
