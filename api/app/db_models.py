from __future__ import annotations

import uuid
from datetime import date, datetime

from sqlalchemy import ARRAY, JSON, Boolean, Date, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


class Company(Base):
    __tablename__ = "companies"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Location(Base):
    __tablename__ = "locations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("companies.id"))
    name: Mapped[str] = mapped_column(String)


class Employee(Base):
    __tablename__ = "employees"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("companies.id"))
    location_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("locations.id"))
    max_user_id: Mapped[str | None] = mapped_column(String, unique=True, nullable=True)
    # Персональный код из ссылки руководителя (README/бот: join_<code>) —
    # присваивается при создании, гасится (→ None) при первой успешной
    # привязке max_user_id, чтобы ссылку нельзя было переиспользовать.
    invite_code: Mapped[str | None] = mapped_column(String, unique=True, nullable=True)
    full_name: Mapped[str] = mapped_column(String)
    position: Mapped[str] = mapped_column(String)
    roles: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    hire_date: Mapped[date] = mapped_column(Date)
    leave_balance_days: Mapped[float] = mapped_column(Float, default=28)
    balance_as_of: Mapped[date] = mapped_column(Date)
    category: Mapped[str | None] = mapped_column(String, nullable=True)
    # Ниже — поля для матчинга подмен (README §8 «Матчинг подмен»): дистанция и
    # история выходов смоделированы, т.к. реальной геолокации/учёта смен в MVP нет.
    distance_km: Mapped[float | None] = mapped_column(Float, nullable=True)
    shifts_completed: Mapped[int] = mapped_column(Integer, default=0)
    shifts_no_show: Mapped[int] = mapped_column(Integer, default=0)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=True)

    location: Mapped["Location"] = relationship()


class LeaveRequest(Base):
    __tablename__ = "leave_requests"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    employee_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("employees.id"))
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date] = mapped_column(Date)
    calendar_days: Mapped[int] = mapped_column(Integer)
    chargeable_days: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String, default="pending")
    verdict_level: Mapped[str] = mapped_column(String)
    # Снимок вердикта на момент подачи — submit пересчитывает и не доверяет
    # preview с клиента (архитектурный MD, принцип 1; контракт §2 сценарий 4).
    verdict_json: Mapped[dict] = mapped_column(JSON)
    rules_version: Mapped[str] = mapped_column(String)
    notify_deadline: Mapped[date] = mapped_column(Date)
    pay_deadline: Mapped[date] = mapped_column(Date)
    comment: Mapped[str | None] = mapped_column(String, nullable=True)
    reject_reason: Mapped[str | None] = mapped_column(String, nullable=True)
    alternative_start: Mapped[date | None] = mapped_column(Date, nullable=True)
    alternative_end: Mapped[date | None] = mapped_column(Date, nullable=True)
    replaces_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Метки "уже отправлено" для напоминаний планировщика (README §9 №13) —
    # без них при каждом проходе шедулера напоминание уходило бы повторно.
    # NULL = ещё не отправлено; дальше — просто timestamp отправки.
    employee_reminder_sent_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    accountant_reminder_sent_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    manager_escalation_sent_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    employee: Mapped["Employee"] = relationship()
    documents: Mapped[list["Document"]] = relationship(order_by="Document.issued_at")


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    request_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("leave_requests.id"))
    kind: Mapped[str] = mapped_column(String)
    number: Mapped[str] = mapped_column(String)
    status: Mapped[str] = mapped_column(String, default="formed")
    issued_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    signers: Mapped[list] = mapped_column(JSON, default=list)
    storage_path: Mapped[str] = mapped_column(String, default="")
    sha256: Mapped[str] = mapped_column(String, default="")


class Shift(Base):
    __tablename__ = "shifts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    location_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("locations.id"))
    starts_at: Mapped[datetime] = mapped_column(DateTime)
    ends_at: Mapped[datetime] = mapped_column(DateTime)
    role_required: Mapped[str] = mapped_column(String)
    skills_required: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    status: Mapped[str] = mapped_column(String, default="open")
    # Заявка на отпуск, которая освободила эту смену (README §7 шаг 6) — не FK
    # на leave_requests, чтобы смена могла существовать и без отпуска.
    source_request_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)


class ShiftOffer(Base):
    __tablename__ = "shift_offers"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    shift_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("shifts.id"))
    employee_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("employees.id"))
    score: Mapped[float] = mapped_column(Float)
    reasons: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    status: Mapped[str] = mapped_column(String, default="proposed")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class AvailabilityWindow(Base):
    __tablename__ = "availability_windows"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    employee_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("employees.id"))
    weekday: Mapped[str] = mapped_column(String)
    time_from: Mapped[str] = mapped_column(String)
    time_to: Mapped[str] = mapped_column(String)
    open_for_extra: Mapped[bool] = mapped_column(Boolean, default=True)


class AuditLog(Base):
    """Аппенд-онли цепочка (hash/prev_hash) — журнал согласований для проверки ГИТ (README §9, №9)."""

    __tablename__ = "audit_log"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    occurred_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    actor_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    actor_name: Mapped[str] = mapped_column(String)
    entity: Mapped[str] = mapped_column(String)
    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    action: Mapped[str] = mapped_column(String)
    from_status: Mapped[str | None] = mapped_column(String, nullable=True)
    to_status: Mapped[str | None] = mapped_column(String, nullable=True)
    method: Mapped[str | None] = mapped_column(String, nullable=True)
    hash: Mapped[str] = mapped_column(String)
    prev_hash: Mapped[str | None] = mapped_column(String, nullable=True)
