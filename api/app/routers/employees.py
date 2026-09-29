from __future__ import annotations

import secrets
from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import require_role
from ..db import get_db
from ..db_models import Employee
from ..errors import conflict, not_found
from ..schemas import CreatedEmployee, CreateEmployeeRequest, LeaveBalance, LinkEmployeeRequest, Me

router = APIRouter(tags=["Employees"])


def _generate_invite_code() -> str:
    return secrets.token_urlsafe(9)


@router.post("/employees", response_model=CreatedEmployee, status_code=201)
def create_employee(
    payload: CreateEmployeeRequest,
    manager: Employee = Depends(require_role("manager", "admin")),
    db: Session = Depends(get_db),
) -> CreatedEmployee:
    """Контракт §2 сценарий 1: руководитель создаёт запись сотрудника и
    получает персональную ссылку-приглашение (join_<inviteCode>, строит её
    бот). Новый сотрудник наследует компанию и точку руководителя — в MVP
    одна точка на компанию (README §12 — данные смоделированы)."""
    employee = Employee(
        company_id=manager.company_id,
        location_id=manager.location_id,
        invite_code=_generate_invite_code(),
        full_name=payload.full_name,
        position=payload.position,
        roles=[payload.role.value],
        hire_date=date.today(),
        leave_balance_days=28,
        balance_as_of=date.today(),
    )
    db.add(employee)
    db.commit()
    db.refresh(employee)

    return CreatedEmployee(
        id=employee.id,
        full_name=employee.full_name,
        position=employee.position,
        roles=employee.roles,
        invite_code=employee.invite_code,
    )


@router.post("/employees/link", response_model=Me)
def link_employee(payload: LinkEmployeeRequest, db: Session = Depends(get_db)) -> Me:
    """Единственный эндпоинт без Depends(get_current_employee) — вызывающий
    на этом шаге ещё не привязанный сотрудник. inviteCode одноразовый:
    гасится сразу после использования (см. ниже), поэтому повторный переход
    по той же ссылке просто не находит код — 404, а не «уже использован»."""
    employee = db.execute(
        select(Employee).where(Employee.invite_code == payload.invite_code)
    ).scalar_one_or_none()
    if employee is None:
        raise not_found("Код приглашения не найден или уже использован")

    taken = db.execute(
        select(Employee).where(Employee.max_user_id == payload.max_user_id)
    ).scalar_one_or_none()
    if taken is not None:
        raise conflict("Этот аккаунт MAX уже привязан к другому сотруднику")

    employee.max_user_id = payload.max_user_id
    employee.invite_code = None
    db.commit()
    db.refresh(employee)

    return Me(
        id=employee.id,
        full_name=employee.full_name,
        position=employee.position,
        location_id=employee.location_id,
        location_name=employee.location.name if employee.location else None,
        roles=employee.roles,
        leave_balance=LeaveBalance(days=employee.leave_balance_days, as_of=employee.balance_as_of),
        is_demo=employee.is_demo,
    )
