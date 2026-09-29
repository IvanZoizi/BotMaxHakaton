from __future__ import annotations

from datetime import date, datetime, time
from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..audit import record as record_audit
from ..audit_view import build_history
from ..auth import get_current_employee, require_role
from ..db import get_db
from ..db_models import Document, Employee, LeaveRequest, ScheduleT7Entry, Shift
from ..errors import already_resolved, conflict, forbidden, not_found, rule_violation, validation_error
from ..matching import score_candidates
from ..notify_client import (
    notify_leave_request_cancelled,
    notify_leave_request_decided,
    notify_leave_request_submitted,
)
from ..pdf import generate_document_pdf
from ..rules import DateRange, EmployeeContext, LeaveRequestContext, TeamOverlap, accrued_balance
from ..rules import Verdict as VerdictDTO
from ..rules import VerdictLevel
from ..rules_engine_instance import rules_engine
from ..schemas import ApproveLeaveRequest, DocumentSummary
from ..schemas import Employee as EmployeeDTO
from ..schemas import ErrorDetail, LeaveRequestDetail, LeaveRequestSummary, PreviewRequest, RejectLeaveRequest, Signer
from ..schemas import SubmitLeaveRequest
from ..util import parse_uuid_or_404

router = APIRouter(tags=["LeaveRequests"])

_OCCUPYING_STATUSES = ("pending", "approved", "active")
_BACK_OFFICE_ROLES = {"accountant", "admin"}

# README §7 демо-данные: точка работает 09:00–21:00 — те же часы, что окна
# доступности в seed.py. Открытая смена на период отпуска (§0 плана,
# scope-решение #19) заводится на эти часы за неимением модели обычного
# графика сотрудника.
_SHIFT_DAY_START = time(9, 0)
_SHIFT_DAY_END = time(21, 0)


def _employee_context(db: Session, employee: Employee, *, as_of: date | None = None) -> EmployeeContext:
    as_of = as_of or date.today()
    approved = db.execute(
        select(LeaveRequest).where(
            LeaveRequest.employee_id == employee.id,
            LeaveRequest.status == "approved",
        )
    ).scalars().all()
    parts_this_year = [r.chargeable_days for r in approved if r.start_date.year == as_of.year]
    last_leave_end = max((r.end_date for r in approved), default=None)

    t7_entry = db.execute(
        select(ScheduleT7Entry).where(
            ScheduleT7Entry.employee_id == employee.id,
            ScheduleT7Entry.year == as_of.year,
            ScheduleT7Entry.status == "approved",
        )
    ).scalar_one_or_none()
    approved_schedule = (
        DateRange(start_date=t7_entry.start_date, end_date=t7_entry.end_date) if t7_entry else None
    )

    return EmployeeContext(
        id=str(employee.id),
        full_name=employee.full_name,
        hire_date=employee.hire_date,
        leave_balance_days=accrued_balance(employee.leave_balance_days, employee.balance_as_of, as_of=as_of),
        balance_as_of=as_of,
        category=employee.category,
        last_leave_end_date=last_leave_end,
        approved_leave_parts_this_year=parts_this_year,
        approved_schedule=approved_schedule,
    )


def _team_overlaps(db: Session, employee: Employee, start: date, end: date) -> list[TeamOverlap]:
    rows = db.execute(
        select(LeaveRequest)
        .join(Employee, Employee.id == LeaveRequest.employee_id)
        .where(
            Employee.location_id == employee.location_id,
            LeaveRequest.employee_id != employee.id,
            LeaveRequest.status.in_(_OCCUPYING_STATUSES),
            LeaveRequest.start_date <= end,
            LeaveRequest.end_date >= start,
        )
    ).scalars().all()
    return [
        TeamOverlap(
            employee_id=str(row.employee_id),
            full_name=row.employee.full_name,
            start_date=row.start_date,
            end_date=row.end_date,
        )
        for row in rows
    ]


def _request_context(db: Session, employee: Employee, start: date, end: date) -> LeaveRequestContext:
    return LeaveRequestContext(start_date=start, end_date=end, team_overlaps=_team_overlaps(db, employee, start, end))


def _check_date_order(start: date, end: date) -> None:
    if end < start:
        raise validation_error(
            "Некорректные даты периода",
            [ErrorDetail(field="endDate", issue="должна быть не раньше startDate")],
        )


@router.post("/leave-requests/preview", response_model=VerdictDTO)
def preview_leave_request(
    payload: PreviewRequest,
    employee: Employee = Depends(get_current_employee),
    db: Session = Depends(get_db),
) -> VerdictDTO:
    _check_date_order(payload.start_date, payload.end_date)
    emp_ctx = _employee_context(db, employee, as_of=payload.start_date)
    req_ctx = _request_context(db, employee, payload.start_date, payload.end_date)
    return rules_engine.evaluate(emp_ctx, req_ctx)


def _document_summary(document: Document) -> DocumentSummary:
    return DocumentSummary(
        id=document.id,
        kind=document.kind,
        number=document.number,
        request_id=document.request_id,
        status=document.status,
        issued_at=document.issued_at,
        signers=[Signer(**s) for s in document.signers],
    )


def _to_summary(leave_request: LeaveRequest) -> LeaveRequestSummary:
    return LeaveRequestSummary(
        id=leave_request.id,
        employee=EmployeeDTO(
            id=leave_request.employee.id,
            full_name=leave_request.employee.full_name,
            position=leave_request.employee.position,
            location_id=leave_request.employee.location_id,
            location_name=leave_request.employee.location.name if leave_request.employee.location else None,
        ),
        start_date=leave_request.start_date,
        end_date=leave_request.end_date,
        calendar_days=leave_request.calendar_days,
        chargeable_days=leave_request.chargeable_days,
        status=leave_request.status,
        verdict_level=leave_request.verdict_level,
        notify_deadline=leave_request.notify_deadline,
        pay_deadline=leave_request.pay_deadline,
        comment=leave_request.comment,
        created_at=leave_request.created_at,
        documents=[_document_summary(d) for d in leave_request.documents],
    )


def _to_detail(db: Session, leave_request: LeaveRequest) -> LeaveRequestDetail:
    summary = _to_summary(leave_request)
    return LeaveRequestDetail(
        **summary.model_dump(),
        verdict=VerdictDTO.model_validate(leave_request.verdict_json),
        reject_reason=leave_request.reject_reason,
        replaces_id=leave_request.replaces_id,
        history=build_history(db, entity="leave_request", entity_id=leave_request.id),
    )


@router.get("/leave-requests", response_model=list[LeaveRequestSummary])
def list_leave_requests(
    scope: Literal["mine", "inbox", "deadlines"] = Query(...),
    employee: Employee = Depends(get_current_employee),
    db: Session = Depends(get_db),
) -> list[LeaveRequestSummary]:
    if scope == "mine":
        rows = (
            db.execute(
                select(LeaveRequest)
                .where(LeaveRequest.employee_id == employee.id)
                .order_by(LeaveRequest.created_at.desc())
            )
            .scalars()
            .all()
        )
    elif scope == "inbox":
        if "manager" not in employee.roles:
            raise forbidden("Входящие доступны только руководителю")
        rows = (
            db.execute(
                select(LeaveRequest)
                .join(Employee, Employee.id == LeaveRequest.employee_id)
                .where(Employee.location_id == employee.location_id)
                .order_by(LeaveRequest.created_at.desc())
            )
            .scalars()
            .all()
        )
    else:  # deadlines — GAP-04
        if not (_BACK_OFFICE_ROLES | {"manager"}) & set(employee.roles):
            raise forbidden("Сроки выплат доступны бухгалтеру, руководителю и администратору")
        rows = (
            db.execute(
                select(LeaveRequest)
                .join(Employee, Employee.id == LeaveRequest.employee_id)
                .where(
                    Employee.company_id == employee.company_id,
                    LeaveRequest.status.in_(("pending", "approved")),
                    LeaveRequest.paid_at.is_(None),
                )
                .order_by(LeaveRequest.pay_deadline)
            )
            .scalars()
            .all()
        )
    return [_to_summary(r) for r in rows]


@router.post("/leave-requests/{request_id}/mark-paid", response_model=LeaveRequestDetail)
def mark_leave_request_paid(
    request_id: str,
    employee: Employee = Depends(require_role("accountant", "admin")),
    db: Session = Depends(get_db),
) -> LeaveRequestDetail:
    """GAP-04: «Отметить выплату» на экране бухгалтера «Сроки выплат»."""
    leave_request = _get_request_or_404(db, request_id)
    if leave_request.employee.company_id != employee.company_id:
        raise forbidden("Эта заявка вам недоступна")
    if leave_request.paid_at is not None:
        return _to_detail(db, leave_request)  # идемпотентно

    leave_request.paid_at = datetime.utcnow()
    db.flush()
    record_audit(
        db,
        actor_id=employee.id,
        actor_name=employee.full_name,
        entity="leave_request",
        entity_id=leave_request.id,
        action="mark_paid",
        from_status=leave_request.status,
        to_status=leave_request.status,
    )
    db.commit()
    db.refresh(leave_request)
    return _to_detail(db, leave_request)


@router.post("/leave-requests", response_model=LeaveRequestDetail, status_code=201)
def submit_leave_request(
    payload: SubmitLeaveRequest,
    employee: Employee = Depends(get_current_employee),
    db: Session = Depends(get_db),
) -> LeaveRequestDetail:
    _check_date_order(payload.start_date, payload.end_date)
    emp_ctx = _employee_context(db, employee, as_of=payload.start_date)
    req_ctx = _request_context(db, employee, payload.start_date, payload.end_date)
    verdict = rules_engine.evaluate(emp_ctx, req_ctx)

    if verdict.level == VerdictLevel.RED:
        matches_suggestion = (
            verdict.suggestion is not None
            and verdict.suggestion.start_date == payload.start_date
            and verdict.suggestion.end_date == payload.end_date
        )
        if not matches_suggestion:
            raise rule_violation("Вердикт красный: даты не совпадают с ближайшей допустимой датой из preview")

    leave_request = LeaveRequest(
        employee_id=employee.id,
        start_date=payload.start_date,
        end_date=payload.end_date,
        calendar_days=verdict.calendar_days,
        chargeable_days=verdict.chargeable_days,
        status="pending",
        verdict_level=verdict.level.value,
        verdict_json=verdict.model_dump(mode="json", by_alias=True),
        rules_version=verdict.rules_version,
        notify_deadline=verdict.notify_by,
        pay_deadline=verdict.pay_by,
        comment=payload.comment,
    )
    db.add(leave_request)
    db.flush()

    record_audit(
        db,
        actor_id=employee.id,
        actor_name=employee.full_name,
        entity="leave_request",
        entity_id=leave_request.id,
        action="submit",
        from_status=None,
        to_status="pending",
    )
    db.commit()
    db.refresh(leave_request)

    _notify_managers_of_submission(db, leave_request, employee)

    return _to_detail(db, leave_request)


def _notify_managers_of_submission(db: Session, leave_request: LeaveRequest, employee: Employee) -> None:
    """README/контракт §2 сценарий 4: «worker шлёт карточку руководителю в
    чат (вне этого API)» — этот вызов и есть тот worker. Шлём всем
    руководителям точки, не только одному — на точке может быть не один."""
    managers = (
        db.execute(
            select(Employee).where(
                Employee.location_id == employee.location_id,
                Employee.roles.any("manager"),
            )
        )
        .scalars()
        .all()
    )
    for manager in managers:
        notify_leave_request_submitted(
            manager_max_user_id=manager.max_user_id,
            request_id=str(leave_request.id),
            employee_full_name=employee.full_name,
            employee_position=employee.position,
            location_name=employee.location.name if employee.location else None,
            start_date=leave_request.start_date.isoformat(),
            end_date=leave_request.end_date.isoformat(),
            calendar_days=leave_request.calendar_days,
            verdict_level=leave_request.verdict_level,
            pay_deadline=leave_request.pay_deadline.isoformat(),
        )


def _get_request_or_404(db: Session, request_id: str) -> LeaveRequest:
    leave_request = db.get(LeaveRequest, parse_uuid_or_404(request_id, "Заявка не найдена"))
    if leave_request is None:
        raise not_found("Заявка не найдена")
    return leave_request


def _require_manager_for_request(employee: Employee, leave_request: LeaveRequest) -> None:
    if "manager" not in employee.roles or leave_request.employee.location_id != employee.location_id:
        raise forbidden("Эта заявка вам недоступна")


@router.get("/leave-requests/{request_id}", response_model=LeaveRequestDetail)
def get_leave_request(
    request_id: str,
    employee: Employee = Depends(get_current_employee),
    db: Session = Depends(get_db),
) -> LeaveRequestDetail:
    leave_request = _get_request_or_404(db, request_id)
    is_owner = leave_request.employee_id == employee.id
    is_manager = "manager" in employee.roles and leave_request.employee.location_id == employee.location_id
    is_back_office = bool({"accountant", "admin"} & set(employee.roles))
    if not (is_owner or is_manager or is_back_office):
        raise forbidden("Эта заявка вам недоступна")
    return _to_detail(db, leave_request)


@router.post("/leave-requests/{request_id}/approve", response_model=LeaveRequestDetail)
def approve_leave_request(
    request_id: str,
    payload: ApproveLeaveRequest,
    employee: Employee = Depends(get_current_employee),
    db: Session = Depends(get_db),
) -> LeaveRequestDetail:
    leave_request = _get_request_or_404(db, request_id)
    _require_manager_for_request(employee, leave_request)

    if leave_request.status == "approved":
        return _to_detail(db, leave_request)  # идемпотентно, openapi.yaml описывает approve именно так
    if leave_request.status != "pending":
        raise conflict("Заявка уже в статусе, несовместимом с согласованием")

    from_status = leave_request.status
    leave_request.status = "approved"

    # Расходуем баланс на дату начала отпуска — до сих пор согласование
    # никак не уменьшало leave_balance_days, что позволяло взять больше дней,
    # чем реально оставалось (баг, не только недостающая фича #17).
    subject = leave_request.employee
    subject.leave_balance_days = (
        accrued_balance(subject.leave_balance_days, subject.balance_as_of, as_of=leave_request.start_date)
        - leave_request.chargeable_days
    )
    subject.balance_as_of = leave_request.start_date
    db.flush()

    docs_to_create = (
        ("application", f"№ {leave_request.id.hex[:6]}/{leave_request.start_date.year}", "formed", []),
        ("order_t6", f"Т-6 № {leave_request.id.hex[:6]}/{leave_request.start_date.year}", "to_sign", []),
        (
            "notice",
            f"Уведомление № {leave_request.id.hex[:6]}/{leave_request.start_date.year}",
            "to_sign",
            [
                {
                    "employeeId": str(subject.id),
                    "fullName": subject.full_name,
                    "role": "employee",
                    "signedAt": None,
                    "method": None,
                }
            ],
        ),
    )
    for kind, number, status, signers in docs_to_create:
        document = Document(request_id=leave_request.id, kind=kind, number=number, status=status, signers=signers)
        db.add(document)
        db.flush()
        lines = [
            f"Сотрудник: {leave_request.employee.full_name}",
            f"Период отпуска: {leave_request.start_date.isoformat()} — {leave_request.end_date.isoformat()}",
            f"Календарных дней: {leave_request.calendar_days}, оплачиваемых: {leave_request.chargeable_days}",
        ]
        path, sha256 = generate_document_pdf(str(document.id), kind, number, lines)
        document.storage_path = str(path)
        document.sha256 = sha256

    # README §7 шаг 6 / №19: отпуск открывает смену — заводим её открытой,
    # руководитель находит её в «Открытые смены» (GET /shifts?status=open) и
    # сам подбирает замену через уже работающий Substitution-флоу.
    open_shift = Shift(
        location_id=subject.location_id,
        starts_at=datetime.combine(leave_request.start_date, _SHIFT_DAY_START),
        ends_at=datetime.combine(leave_request.end_date, _SHIFT_DAY_END),
        role_required=subject.position,
        skills_required=[],
        status="open",
        source_request_id=leave_request.id,
    )
    db.add(open_shift)

    record_audit(
        db,
        actor_id=employee.id,
        actor_name=employee.full_name,
        entity="leave_request",
        entity_id=leave_request.id,
        action="approve",
        from_status=from_status,
        to_status="approved",
        method=payload.method.value,
    )
    db.commit()
    db.refresh(leave_request)

    notify_leave_request_decided(
        employee_max_user_id=leave_request.employee.max_user_id,
        request_id=str(leave_request.id),
        status="approved",
        start_date=leave_request.start_date.isoformat(),
        end_date=leave_request.end_date.isoformat(),
    )

    return _to_detail(db, leave_request)


@router.post("/leave-requests/{request_id}/reject", response_model=LeaveRequestDetail)
def reject_leave_request(
    request_id: str,
    payload: RejectLeaveRequest,
    employee: Employee = Depends(get_current_employee),
    db: Session = Depends(get_db),
) -> LeaveRequestDetail:
    leave_request = _get_request_or_404(db, request_id)
    _require_manager_for_request(employee, leave_request)

    if payload.reason_code.value == "other" and not payload.reason_text:
        raise validation_error(
            "Укажите причину отказа",
            [ErrorDetail(field="reasonText", issue="обязателен при reasonCode = other")],
        )
    if leave_request.status != "pending":
        raise already_resolved(f"Заявка уже в статусе «{leave_request.status}»")

    from_status = leave_request.status
    leave_request.status = "rejected"
    leave_request.reject_reason = payload.reason_text or payload.reason_code.value
    leave_request.alternative_start = payload.alternative_start
    leave_request.alternative_end = payload.alternative_end
    db.flush()

    record_audit(
        db,
        actor_id=employee.id,
        actor_name=employee.full_name,
        entity="leave_request",
        entity_id=leave_request.id,
        action="reject",
        from_status=from_status,
        to_status="rejected",
    )
    db.commit()
    db.refresh(leave_request)

    notify_leave_request_decided(
        employee_max_user_id=leave_request.employee.max_user_id,
        request_id=str(leave_request.id),
        status="rejected",
        start_date=leave_request.start_date.isoformat(),
        end_date=leave_request.end_date.isoformat(),
        reject_reason=leave_request.reject_reason,
    )

    return _to_detail(db, leave_request)


@router.post("/leave-requests/{request_id}/cancel", response_model=LeaveRequestDetail)
def cancel_leave_request(
    request_id: str,
    employee: Employee = Depends(get_current_employee),
    db: Session = Depends(get_db),
) -> LeaveRequestDetail:
    """№25: отзыв допустим для pending (заявка ещё не решена) и approved
    (отпуск ещё не начался — сотрудник передумал); active/completed не
    трогаем, отпуск уже идёт или прошёл."""
    leave_request = _get_request_or_404(db, request_id)
    if leave_request.employee_id != employee.id:
        raise forbidden("Эта заявка вам недоступна")
    if leave_request.status not in ("pending", "approved"):
        raise conflict("Заявка не в статусе pending/approved — отзыв недоступен")

    from_status = leave_request.status
    was_approved = from_status == "approved"
    leave_request.status = "cancelled"
    for document in leave_request.documents:
        document.status = "annulled"

    if was_approved:
        # Возвращаем списанный при согласовании баланс (см. approve_leave_request) —
        # без пересчёта накопления заново, см. scope-решение в плане.
        subject = leave_request.employee
        subject.leave_balance_days = round(subject.leave_balance_days + leave_request.chargeable_days, 2)

        # Смена, открытая этим отпуском, больше не нужна — но только если её
        # ещё никто не подхватил (иначе трогать чужое предложение не будем).
        open_shift = db.execute(
            select(Shift).where(Shift.source_request_id == leave_request.id, Shift.status == "open")
        ).scalar_one_or_none()
        if open_shift is not None:
            db.delete(open_shift)

    db.flush()

    record_audit(
        db,
        actor_id=employee.id,
        actor_name=employee.full_name,
        entity="leave_request",
        entity_id=leave_request.id,
        action="cancel",
        from_status=from_status,
        to_status="cancelled",
    )
    db.commit()
    db.refresh(leave_request)

    if was_approved:
        managers = db.execute(
            select(Employee).where(
                Employee.location_id == leave_request.employee.location_id,
                Employee.roles.any("manager"),
            )
        ).scalars().all()
        for manager in managers:
            notify_leave_request_cancelled(
                manager_max_user_id=manager.max_user_id,
                request_id=str(leave_request.id),
                employee_full_name=leave_request.employee.full_name,
                start_date=leave_request.start_date.isoformat(),
                end_date=leave_request.end_date.isoformat(),
            )

    return _to_detail(db, leave_request)
