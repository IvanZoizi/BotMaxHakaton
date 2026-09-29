from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..auth import require_role
from ..db import get_db
from ..db_models import Company, Employee, Location
from ..errors import conflict
from ..schemas import CompanySummary, CreateCompanyRequest, CreateLocationRequest, LeaveBalance, LocationSummary, Me

router = APIRouter(tags=["Companies"])


@router.post("/companies", response_model=Me, status_code=201)
def create_company(payload: CreateCompanyRequest, db: Session = Depends(get_db)) -> Me:
    """Мультитенантный вход «с нуля» — симметрично POST /employees/link:
    вызывающий ещё не привязан ни к какой компании (курица-яйцо у самой
    первой компании: admin/manager, который выдал бы invite-код, ещё не
    существует). Один MAX-аккаунт = один сотрудник во всей системе, как и у
    link_employee — если max_user_id уже где-то привязан, отказываем."""
    taken = db.execute(select(Employee).where(Employee.max_user_id == payload.max_user_id)).scalar_one_or_none()
    if taken is not None:
        raise conflict("Этот аккаунт MAX уже привязан к сотруднику")

    company = Company(name=payload.name)
    db.add(company)
    db.flush()

    location = Location(company_id=company.id, name=payload.location_name)
    db.add(location)
    db.flush()

    admin = Employee(
        company_id=company.id,
        location_id=location.id,
        max_user_id=payload.max_user_id,
        full_name=payload.admin_full_name,
        position="Владелец компании",
        # admin — функция сверх основной работы, не замена ей: владелец
        # тоже сотрудник и должен видеть «Оформить отпуск» на себя (см. тот
        # же комментарий в routers/employees.py create_employee).
        roles=["admin", "employee"],
        hire_date=date.today(),
        leave_balance_days=28,
        balance_as_of=date.today(),
        is_demo=False,
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)

    return Me(
        id=admin.id,
        full_name=admin.full_name,
        position=admin.position,
        location_id=admin.location_id,
        location_name=location.name,
        roles=admin.roles,
        leave_balance=LeaveBalance(days=admin.leave_balance_days, as_of=admin.balance_as_of),
        is_demo=admin.is_demo,
    )


@router.post("/locations", response_model=LocationSummary, status_code=201)
def create_location(
    payload: CreateLocationRequest,
    admin: Employee = Depends(require_role("admin")),
    db: Session = Depends(get_db),
) -> LocationSummary:
    """Шаг 2 CompanyConnect («Подразделение») — добавление точки в уже
    существующую компанию, до приглашения туда руководителя."""
    location = Location(company_id=admin.company_id, name=payload.name)
    db.add(location)
    db.commit()
    db.refresh(location)
    return LocationSummary(id=location.id, name=location.name)


@router.get("/companies/me/summary", response_model=CompanySummary)
def get_company_summary(
    admin: Employee = Depends(require_role("admin")),
    db: Session = Depends(get_db),
) -> CompanySummary:
    locations_count = db.execute(
        select(func.count()).select_from(Location).where(Location.company_id == admin.company_id)
    ).scalar_one()
    company_employees = select(Employee).where(Employee.company_id == admin.company_id).subquery()
    managers_invited = db.execute(
        select(func.count()).select_from(company_employees).where(company_employees.c.roles.any("manager"))
    ).scalar_one()
    employees_invited = db.execute(select(func.count()).select_from(company_employees)).scalar_one()
    employees_connected = db.execute(
        select(func.count()).select_from(company_employees).where(company_employees.c.max_user_id.is_not(None))
    ).scalar_one()

    return CompanySummary(
        locations=locations_count,
        managers_invited=managers_invited,
        employees_connected=employees_connected,
        employees_invited=employees_invited,
        location_name=admin.location.name if admin.location else None,
    )
