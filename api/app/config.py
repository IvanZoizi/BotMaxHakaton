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


settings = Settings()
