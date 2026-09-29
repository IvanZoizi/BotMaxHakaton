from __future__ import annotations

import uuid
from datetime import date, datetime
from enum import Enum

from pydantic import Field

from .rules.models import CamelModel, Role, Verdict, VerdictLevel

__all__ = [
    "LeaveBalance",
    "Me",
    "Employee",
    "LeaveRequestStatus",
    "DocumentKind",
    "DocumentStatus",
    "ApprovalMethod",
    "Signer",
    "HistoryEvent",
    "DocumentSummary",
    "DocumentDetail",
    "LeaveRequestSummary",
    "LeaveRequestDetail",
    "PreviewRequest",
    "SubmitLeaveRequest",
    "ApproveLeaveRequest",
    "RejectReasonCode",
    "RejectLeaveRequest",
    "TeamCalendarEntry",
    "ShiftCandidate",
    "CreateShiftOfferRequest",
    "ShiftOfferStatus",
    "ShiftOffer",
    "Weekday",
    "AvailabilityWindow",
    "AuditEntry",
    "ErrorCode",
    "ErrorDetail",
    "ErrorBody",
    "ErrorResponse",
]


class LeaveBalance(CamelModel):
    days: float
    as_of: date


class Me(CamelModel):
    id: uuid.UUID
    full_name: str
    position: str
    location_id: uuid.UUID | None = None
    location_name: str | None = None
    roles: list[Role]
    leave_balance: LeaveBalance
    is_demo: bool


class Employee(CamelModel):
    id: uuid.UUID
    full_name: str
    position: str
    location_id: uuid.UUID
    location_name: str | None = None


class CreateEmployeeRequest(CamelModel):
    """Не входит в 16 путей openapi.yaml — контракт прямо оставляет
    подключение сотрудника «вне API, бот-логика» (§2, сценарий 1). Решение
    команды: руководитель создаёт запись и получает персональную ссылку
    (join_<inviteCode>), сотрудник переходит по ней и привязывается —
    см. POST /employees/link."""

    full_name: str
    position: str
    role: Role = Role.EMPLOYEE


class CreatedEmployee(CamelModel):
    id: uuid.UUID
    full_name: str
    position: str
    roles: list[Role]
    invite_code: str


class LinkEmployeeRequest(CamelModel):
    """Без аутентификации — на этом шаге вызывающий ещё не привязан ни к
    какому сотруднику. inviteCode сам по себе — секрет, дающий право на
    привязку (модель "код из персональной ссылки = достаточное основание")."""

    invite_code: str
    max_user_id: str


class LeaveRequestStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    CANCELLED = "cancelled"
    ACTIVE = "active"
    COMPLETED = "completed"


class DocumentKind(str, Enum):
    APPLICATION = "application"
    ORDER_T6 = "order_t6"
    SCHEDULE_T7 = "schedule_t7"


class DocumentStatus(str, Enum):
    FORMED = "formed"
    TO_SIGN = "to_sign"
    SIGNED = "signed"
    IN_ACCOUNTING = "in_accounting"
    ARCHIVED = "archived"
    ANNULLED = "annulled"


class ApprovalMethod(str, Enum):
    BIOMETRIC = "biometric"
    CONFIRM = "confirm"


class Signer(CamelModel):
    employee_id: uuid.UUID
    full_name: str
    role: str
    signed_at: datetime | None = None
    method: ApprovalMethod | None = None


class HistoryEvent(CamelModel):
    occurred_at: datetime
    action: str
    from_status: LeaveRequestStatus | None = None
    to_status: LeaveRequestStatus
    actor_id: uuid.UUID
    actor_name: str
    method: ApprovalMethod | None = None


class DocumentSummary(CamelModel):
    id: uuid.UUID
    kind: DocumentKind
    number: str
    request_id: uuid.UUID
    status: DocumentStatus
    issued_at: datetime
    signers: list[Signer]


class DocumentDetail(DocumentSummary):
    pdf_url: str
    sha256: str
    integrity_verified: bool
    history: list[HistoryEvent]


class LeaveRequestSummary(CamelModel):
    id: uuid.UUID
    employee: Employee
    start_date: date
    end_date: date
    calendar_days: int
    chargeable_days: int
    status: LeaveRequestStatus
    verdict_level: VerdictLevel
    notify_deadline: date
    pay_deadline: date
    comment: str | None = None
    created_at: datetime
    documents: list[DocumentSummary] = Field(default_factory=list)


class LeaveRequestDetail(LeaveRequestSummary):
    verdict: Verdict
    reject_reason: str | None = None
    replaces_id: uuid.UUID | None = None
    history: list[HistoryEvent] = Field(default_factory=list)


class PreviewRequest(CamelModel):
    start_date: date
    end_date: date


class SubmitLeaveRequest(CamelModel):
    start_date: date
    end_date: date
    comment: str | None = Field(default=None, max_length=200)


class ApproveLeaveRequest(CamelModel):
    method: ApprovalMethod


class RejectReasonCode(str, Enum):
    TEAM_OVERLAP = "team_overlap"
    HIGH_LOAD = "high_load"
    OTHER = "other"


class RejectLeaveRequest(CamelModel):
    reason_code: RejectReasonCode
    reason_text: str | None = None
    alternative_start: date | None = None
    alternative_end: date | None = None


class TeamCalendarEntry(CamelModel):
    employee_id: uuid.UUID
    full_name: str
    start_date: date
    end_date: date


class ShiftCandidate(CamelModel):
    employee_id: uuid.UUID
    full_name: str
    position: str
    score: float
    reasons: list[str]


class CreateShiftOfferRequest(CamelModel):
    shift_id: uuid.UUID
    employee_id: uuid.UUID


class ShiftOfferStatus(str, Enum):
    PROPOSED = "proposed"
    ACCEPTED = "accepted"
    DECLINED = "declined"
    EXPIRED = "expired"


class ShiftOffer(CamelModel):
    id: uuid.UUID
    shift_id: uuid.UUID
    employee_id: uuid.UUID
    score: float
    reasons: list[str]
    status: ShiftOfferStatus
    created_at: datetime


class Weekday(str, Enum):
    MON = "mon"
    TUE = "tue"
    WED = "wed"
    THU = "thu"
    FRI = "fri"
    SAT = "sat"
    SUN = "sun"


class AvailabilityWindow(CamelModel):
    weekday: Weekday
    time_from: str
    time_to: str
    open_for_extra: bool


class AuditEntry(CamelModel):
    occurred_at: datetime
    actor_id: uuid.UUID
    actor_name: str
    entity: str
    entity_id: uuid.UUID
    action: str
    from_status: str | None = None
    to_status: str | None = None
    method: ApprovalMethod | None = None
    hash: str
    prev_hash: str | None = None


class ErrorCode(str, Enum):
    NOT_LINKED = "NOT_LINKED"
    FORBIDDEN = "FORBIDDEN"
    NOT_FOUND = "NOT_FOUND"
    VALIDATION_ERROR = "VALIDATION_ERROR"
    RULE_VIOLATION = "RULE_VIOLATION"
    ALREADY_RESOLVED = "ALREADY_RESOLVED"
    CONFLICT = "CONFLICT"


class ErrorDetail(CamelModel):
    field: str | None = None
    issue: str


class ErrorBody(CamelModel):
    code: ErrorCode
    message: str
    details: list[ErrorDetail] = Field(default_factory=list)


class ErrorResponse(CamelModel):
    error: ErrorBody
