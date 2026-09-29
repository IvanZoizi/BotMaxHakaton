from __future__ import annotations

import asyncio
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .db import Base, SessionLocal, engine
from .errors import AppError, app_error_handler
from .files import router as files_router
from .logging_config import configure_logging
from .routers import audit, availability, documents, employees, leave_requests, me, rules, shifts, team
from .scheduler import run_reminder_sweep
from .seed import seed_demo_data

configure_logging()
logger = logging.getLogger(__name__)

app = FastAPI(title="СМЕНА API", version="0.1.0-mvp")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_exception_handler(AppError, app_error_handler)

app.include_router(me.router)
app.include_router(leave_requests.router)
app.include_router(team.router)
app.include_router(rules.router)
app.include_router(documents.router)
app.include_router(shifts.router)
app.include_router(availability.router)
app.include_router(audit.router)
app.include_router(employees.router)
app.include_router(files_router)


_scheduler_task: asyncio.Task | None = None


async def _reminder_loop() -> None:
    """README §9 №13 (напоминания за 14/3 дня, закрытие в день выхода) —
    идемпотентно (scheduler.run_reminder_sweep), поэтому безопасно, если
    цикл догоняет после простоя контейнера."""
    while True:
        try:
            with SessionLocal() as db:
                await asyncio.to_thread(run_reminder_sweep, db)
        except Exception:
            logger.exception("Сбой прохода планировщика напоминаний")
        await asyncio.sleep(settings.reminder_sweep_interval_seconds)


@app.on_event("startup")
async def on_startup() -> None:
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        seed_demo_data(db)
    global _scheduler_task
    _scheduler_task = asyncio.create_task(_reminder_loop())
    logger.info("Планировщик напоминаний запущен, интервал %sс", settings.reminder_sweep_interval_seconds)


@app.on_event("shutdown")
async def on_shutdown() -> None:
    if _scheduler_task is not None:
        _scheduler_task.cancel()


@app.get("/health", tags=["_internal"])
def health() -> dict[str, str]:
    return {"status": "ok"}
