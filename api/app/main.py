from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .db import Base, SessionLocal, engine
from .errors import AppError, app_error_handler
from .files import router as files_router
from .routers import audit, availability, documents, leave_requests, me, rules, shifts, team
from .seed import seed_demo_data

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
app.include_router(files_router)


@app.on_event("startup")
def on_startup() -> None:
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        seed_demo_data(db)


@app.get("/health", tags=["_internal"])
def health() -> dict[str, str]:
    return {"status": "ok"}
