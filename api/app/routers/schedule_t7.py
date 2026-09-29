from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..audit import record as record_audit
from ..auth import get_current_employee, require_role
from ..db import get_db
from ..db_models import Employee, ScheduleT7Entry as ScheduleT7EntryRow
from ..errors import forbidden
from ..schemas import ApproveScheduleT7Request, ScheduleT7Entry, SubmitScheduleT7Entry

router = APIRouter(tags=["ScheduleT7"])


@router.post("/schedule-t7/entries", response_model=ScheduleT7Entry, status_code=201)
def submit_schedule_t7_entry(
    payload: SubmitScheduleT7Entry,
    employee: Employee = Depends(get_current_employee),
    db: Session = Depends(get_db),
) -> ScheduleT7Entry:
    """№24: сотрудник указывает предпочитаемые даты отпуска на будущий год —
    ответ на бот-приглашение /collect_schedule (deeplink t7_<год>)."""
    existing = db.execute(
        select(ScheduleT7EntryRow).where(
            ScheduleT7EntryRow.employee_id == employee.id,
            ScheduleT7EntryRow.year == payload.year,
        )
    ).scalar_one_or_none()

    if existing is not None and existing.status == "approved":
        raise forbidden("График на этот год уже утверждён — правки закрыты")

    if existing is not None:
        existing.start_date = payload.start_date
        existing.end_date = payload.end_date
        entry = existing
    else:
        entry = ScheduleT7EntryRow(
            employee_id=employee.id,
            year=payload.year,
            start_date=payload.start_date,
            end_date=payload.end_date,
            status="proposed",
        )
        db.add(entry)

    db.commit()
    db.refresh(entry)
    return _to_dto(entry, conflicts_with=[])


def _conflicts(entries: list[ScheduleT7EntryRow]) -> dict:
    """employee_id -> список employee_id с пересекающимися датами (та же
    company.team-overlap идея, что и в основном движке правил, но не через
    checks.py — тут сравниваем сырые записи графика, а не заявку)."""
    result: dict = {e.id: [] for e in entries}
    for a in entries:
        for b in entries:
            if a.id == b.id:
                continue
            if a.start_date <= b.end_date and a.end_date >= b.start_date:
                result[a.id].append(b.employee_id)
    return result


@router.get("/schedule-t7", response_model=list[ScheduleT7Entry])
def list_schedule_t7(
    year: int = Query(...),
    employee: Employee = Depends(require_role("manager", "admin")),
    db: Session = Depends(get_db),
) -> list[ScheduleT7Entry]:
    rows = db.execute(
        select(ScheduleT7EntryRow)
        .join(Employee, Employee.id == ScheduleT7EntryRow.employee_id)
        .where(Employee.location_id == employee.location_id, ScheduleT7EntryRow.year == year)
        .order_by(ScheduleT7EntryRow.start_date)
    ).scalars().all()
    conflicts = _conflicts(rows)
    return [_to_dto(row, conflicts_with=conflicts[row.id]) for row in rows]


@router.post("/schedule-t7/approve", response_model=list[ScheduleT7Entry])
def approve_schedule_t7(
    payload: ApproveScheduleT7Request,
    manager: Employee = Depends(require_role("manager")),
    db: Session = Depends(get_db),
) -> list[ScheduleT7Entry]:
    """Руководитель утверждает график точки на год — переводит все proposed
    записи в approved (README §9 №24); дальше tk.123.schedule-t7 в движке
    правил сверяет новые заявки на отпуск с этим графиком."""
    rows = db.execute(
        select(ScheduleT7EntryRow)
        .join(Employee, Employee.id == ScheduleT7EntryRow.employee_id)
        .where(
            Employee.location_id == manager.location_id,
            ScheduleT7EntryRow.year == payload.year,
            ScheduleT7EntryRow.status == "proposed",
        )
    ).scalars().all()

    for row in rows:
        row.status = "approved"
    db.flush()

    # PDF-графика Т-7 сюда сознательно не заводим как Document: вся модель
    # documents (permission-проверки в GET/POST /documents*) завязана на
    # leave_request_id, которого у графика на год нет — заводить отдельный
    # nullable FK ради одного PDF несоразмерно объёму этой фичи.
    record_audit(
        db,
        actor_id=manager.id,
        actor_name=manager.full_name,
        entity="schedule_t7",
        entity_id=manager.location_id,
        action="approve",
        from_status="proposed",
        to_status="approved",
    )
    db.commit()

    conflicts = _conflicts(rows)
    return [_to_dto(row, conflicts_with=conflicts.get(row.id, [])) for row in rows]


def _to_dto(row: ScheduleT7EntryRow, *, conflicts_with: list) -> ScheduleT7Entry:
    return ScheduleT7Entry(
        id=row.id,
        employee_id=row.employee_id,
        full_name=row.employee.full_name,
        year=row.year,
        start_date=row.start_date,
        end_date=row.end_date,
        status=row.status,
        conflicts_with=conflicts_with,
    )
