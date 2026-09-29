from __future__ import annotations

from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from .db_models import AvailabilityWindow, Company, Employee, LeaveRequest, Location
from .rules_engine_instance import rules_engine
from .rules import EmployeeContext, LeaveRequestContext

# Смоделированные демо-данные — README §12: "Всё, что смоделировано, помечено
# в интерфейсе" (is_demo=True). `max_user_id` намеренно совпадает с id из
# frontend/src/api/fixtures.ts (EMPLOYEES/ME_BY_ROLE) — тот же человек в
# моковом и реальном режиме фронтенда, X-Debug-Employee-Id шлёт этот же слаг.


def seed_demo_data(db: Session) -> None:
    if db.execute(select(Company)).first() is not None:
        return

    company = Company(name="Кофейня «Смена» (демо)")
    db.add(company)
    db.flush()

    location = Location(company_id=company.id, name="Баумана, 12")
    db.add(location)
    db.flush()

    balance_as_of = date(2026, 9, 25)

    marina = Employee(
        company_id=company.id,
        location_id=location.id,
        max_user_id="emp-marina",
        full_name="Петрова Марина Алексеевна",
        position="Кассир-консультант",
        roles=["employee"],
        hire_date=date(2023, 3, 1),
        leave_balance_days=28,
        balance_as_of=balance_as_of,
    )
    manager = Employee(
        company_id=company.id,
        location_id=location.id,
        max_user_id="emp-smirnova",
        full_name="Смирнова Елена Викторовна",
        position="Управляющая точкой",
        roles=["manager", "employee"],
        hire_date=date(2021, 1, 10),
        leave_balance_days=24,
        balance_as_of=balance_as_of,
    )
    accountant = Employee(
        company_id=company.id,
        location_id=location.id,
        max_user_id="emp-ivanova",
        full_name="Иванова Ольга Сергеевна",
        position="Бухгалтер",
        roles=["accountant", "employee"],
        hire_date=date(2022, 5, 15),
        leave_balance_days=28,
        balance_as_of=balance_as_of,
    )
    admin = Employee(
        company_id=company.id,
        location_id=location.id,
        max_user_id="emp-volkov",
        full_name="Волков Дмитрий Александрович",
        position="Владелец компании",
        roles=["admin", "employee"],
        hire_date=date(2020, 1, 1),
        leave_balance_days=28,
        balance_as_of=balance_as_of,
    )
    kuznetsov = Employee(
        company_id=company.id,
        location_id=location.id,
        max_user_id="emp-kuznetsov",
        full_name="Кузнецов Артём Павлович",
        position="Продавец-кассир",
        roles=["employee"],
        hire_date=date(2023, 6, 1),
        leave_balance_days=30,
        balance_as_of=balance_as_of,
    )
    sidorov = Employee(
        company_id=company.id,
        location_id=location.id,
        max_user_id="emp-sidorov",
        full_name="Сидоров Игорь Николаевич",
        position="Продавец-кассир",
        roles=["employee"],
        hire_date=date(2024, 1, 15),
        leave_balance_days=12,
        balance_as_of=balance_as_of,
    )
    alexey = Employee(
        company_id=company.id,
        location_id=location.id,
        max_user_id="emp-alexey",
        full_name="Алексей К.",
        position="Продавец-кассир",
        roles=["employee"],
        hire_date=date(2024, 2, 1),
        leave_balance_days=14,
        balance_as_of=balance_as_of,
        distance_km=1.2,
        shifts_completed=12,
        shifts_no_show=0,
    )
    db.add_all([marina, manager, accountant, admin, kuznetsov, sidorov, alexey])
    db.flush()

    for weekday in ("mon", "tue", "thu"):
        db.add(
            AvailabilityWindow(
                employee_id=alexey.id,
                weekday=weekday,
                time_from="09:00",
                time_to="21:00",
                open_for_extra=True,
            )
        )

    # Те же два периода, что в frontend/src/api/fixtures.ts TEAM_CALENDAR —
    # уже approved заявки, чтобы GET /team/calendar отдавал те же окна что
    # видит фронтенд в моковом режиме.
    _seed_approved_leave(db, kuznetsov, date(2026, 10, 5), date(2026, 10, 18))
    _seed_approved_leave(db, sidorov, date(2026, 11, 1), date(2026, 11, 7))

    db.commit()


def _seed_approved_leave(db: Session, employee: Employee, start: date, end: date) -> None:
    verdict = rules_engine.evaluate(
        EmployeeContext(
            id=str(employee.id),
            full_name=employee.full_name,
            hire_date=employee.hire_date,
            leave_balance_days=employee.leave_balance_days,
            balance_as_of=employee.balance_as_of,
        ),
        LeaveRequestContext(start_date=start, end_date=end, today=start),
    )
    db.add(
        LeaveRequest(
            employee_id=employee.id,
            start_date=start,
            end_date=end,
            calendar_days=verdict.calendar_days,
            chargeable_days=verdict.chargeable_days,
            status="approved",
            verdict_level=verdict.level.value,
            verdict_json=verdict.model_dump(mode="json", by_alias=True),
            rules_version=verdict.rules_version,
            notify_deadline=verdict.notify_by,
            pay_deadline=verdict.pay_by,
        )
    )
