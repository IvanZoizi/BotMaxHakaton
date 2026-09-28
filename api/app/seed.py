from __future__ import annotations

from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from .db_models import AvailabilityWindow, Company, Employee, Location

# Смоделированные демо-данные — README §12: "Всё, что смоделировано, помечено
# в интерфейсе" (is_demo=True). Ровно сценарий демо-скрипта README §7:
# Марина Петрова подаёт заявку, Ирина Соколова согласует, Алексей К. — кандидат
# на подмену.
_MAX_USER_PREFIX = "demo-"


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
        max_user_id=f"{_MAX_USER_PREFIX}marina",
        full_name="Марина Петрова",
        position="Кассир-консультант",
        roles=["employee"],
        hire_date=date(2023, 3, 1),
        leave_balance_days=28,
        balance_as_of=balance_as_of,
    )
    manager = Employee(
        company_id=company.id,
        location_id=location.id,
        max_user_id=f"{_MAX_USER_PREFIX}manager",
        full_name="Ирина Соколова",
        position="Управляющая точкой",
        roles=["manager"],
        hire_date=date(2021, 1, 10),
        leave_balance_days=20,
        balance_as_of=balance_as_of,
    )
    accountant = Employee(
        company_id=company.id,
        location_id=location.id,
        max_user_id=f"{_MAX_USER_PREFIX}accountant",
        full_name="Ольга Смирнова",
        position="Бухгалтер",
        roles=["accountant"],
        hire_date=date(2022, 5, 15),
        leave_balance_days=24,
        balance_as_of=balance_as_of,
    )
    admin = Employee(
        company_id=company.id,
        location_id=location.id,
        max_user_id=f"{_MAX_USER_PREFIX}admin",
        full_name="Дмитрий Волков",
        position="Владелец сети",
        roles=["admin", "manager"],
        hire_date=date(2020, 1, 1),
        leave_balance_days=28,
        balance_as_of=balance_as_of,
    )
    alexey = Employee(
        company_id=company.id,
        location_id=location.id,
        max_user_id=f"{_MAX_USER_PREFIX}alexey",
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
    db.add_all([marina, manager, accountant, admin, alexey])
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
    db.commit()
