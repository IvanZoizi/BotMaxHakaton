from __future__ import annotations

import secrets
from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..audit import record as record_audit
from ..auth import get_current_employee, require_role
from ..db import get_db
from ..db_models import Employee, Location
from ..errors import conflict, forbidden, not_found
from ..rules.models import Role
from ..schemas import CreatedEmployee, CreateEmployeeRequest, LeaveBalance
from ..schemas import Employee as EmployeeDTO
from ..schemas import LinkEmployeeRequest, Me, ShiftOutcomeRequest, UpdateEmployeeRequest
from ..util import parse_uuid_or_404

router = APIRouter(tags=["Employees"])


def _to_employee_dto(employee: Employee) -> EmployeeDTO:
    return EmployeeDTO(
        id=employee.id,
        full_name=employee.full_name,
        position=employee.position,
        location_id=employee.location_id,
        location_name=employee.location.name if employee.location else None,
        roles=employee.roles,
        category=employee.category,
        skills=employee.skills,
    )


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
    бот). Новый сотрудник наследует точку руководителя, если admin не указал
    другую (§1a плана мультитенантности — админ может завести руководителя
    сразу в новой точке своей компании)."""
    location_id = manager.location_id
    if payload.location_id is not None:
        if "admin" not in manager.roles:
            raise forbidden("Только администратор может указать другую точку")
        location = db.get(Location, payload.location_id)
        if location is None or location.company_id != manager.company_id:
            raise not_found("Точка не найдена")
        location_id = location.id

    # employee — это ещё и «я сам работаю и могу уйти в отпуск», а не
    # функция вроде manager/accountant/admin. Раньше роль была одна: у
    # бухгалтера/руководителя/админа не было employee, и они физически не
    # видели «Оформить отпуск» — свой же отпуск себе поставить было нельзя.
    roles = [payload.role.value] if payload.role == Role.EMPLOYEE else [Role.EMPLOYEE.value, payload.role.value]

    employee = Employee(
        company_id=manager.company_id,
        location_id=location_id,
        invite_code=_generate_invite_code(),
        full_name=payload.full_name,
        position=payload.position,
        roles=roles,
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


@router.get("/employees", response_model=list[EmployeeDTO])
def list_employees(
    employee: Employee = Depends(require_role("manager", "admin")),
    db: Session = Depends(get_db),
) -> list[EmployeeDTO]:
    """GAP-06: manager видит свою точку, admin — всю компанию (несколько
    точек, §1a плана мультитенантности)."""
    if "admin" in employee.roles:
        stmt = select(Employee).where(Employee.company_id == employee.company_id)
    else:
        stmt = select(Employee).where(Employee.location_id == employee.location_id)
    rows = db.execute(stmt.order_by(Employee.full_name)).scalars().all()
    return [_to_employee_dto(row) for row in rows]


@router.patch("/employees/{employee_id}", response_model=EmployeeDTO)
def update_employee(
    employee_id: str,
    payload: UpdateEmployeeRequest,
    admin: Employee = Depends(require_role("admin")),
    db: Session = Depends(get_db),
) -> EmployeeDTO:
    """GAP-06 + №15: закрывает то, что льготную категорию физически некем
    было назначить — до этого проверка privileged_category в движке правил
    была мёртвым кодом (employee.category нигде не выставлялся)."""
    target = db.get(Employee, parse_uuid_or_404(employee_id, "Сотрудник не найден"))
    if target is None or target.company_id != admin.company_id:
        raise not_found("Сотрудник не найден")

    if payload.full_name is not None:
        target.full_name = payload.full_name
    if payload.position is not None:
        target.position = payload.position
    if payload.roles is not None:
        target.roles = [r.value for r in payload.roles]
    if payload.category is not None:
        target.category = payload.category or None
    if payload.skills is not None:
        target.skills = payload.skills

    db.commit()
    db.refresh(target)
    return _to_employee_dto(target)


@router.post("/employees/{employee_id}/shift-outcome", response_model=EmployeeDTO)
def record_shift_outcome(
    employee_id: str,
    payload: ShiftOutcomeRequest,
    manager: Employee = Depends(require_role("manager")),
    db: Session = Depends(get_db),
) -> EmployeeDTO:
    """№26: без этого shifts_completed/shifts_no_show навсегда остаются
    значениями из seed-данных — рейтинг надёжности никогда не меняется."""
    target = db.get(Employee, parse_uuid_or_404(employee_id, "Сотрудник не найден"))
    if target is None or target.location_id != manager.location_id:
        raise not_found("Сотрудник не найден")

    if payload.completed:
        target.shifts_completed += 1
    else:
        target.shifts_no_show += 1

    db.commit()
    db.refresh(target)

    record_audit(
        db,
        actor_id=manager.id,
        actor_name=manager.full_name,
        entity="employee",
        entity_id=target.id,
        action="shift_completed" if payload.completed else "shift_no_show",
        from_status=None,
        to_status=None,
    )
    db.commit()
    return _to_employee_dto(target)
