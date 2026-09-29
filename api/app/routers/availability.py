from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from ..auth import get_current_employee
from ..db import get_db
from ..db_models import AvailabilityWindow as AvailabilityWindowRow
from ..db_models import Employee
from ..schemas import AvailabilityWindow

router = APIRouter(tags=["Availability"])


@router.get("/me/availability", response_model=list[AvailabilityWindow])
def get_my_availability(
    employee: Employee = Depends(get_current_employee),
    db: Session = Depends(get_db),
) -> list[AvailabilityWindow]:
    """Не входит в 16 путей openapi.yaml (только PUT), но помечена в контракте
    (§1, Figma-анализ) как «Рекомендация» — не GAP, а совместимое расширение,
    без которого PUT-эндпоинт нечем прочитать обратно на экране «Доступность»."""
    rows = (
        db.execute(select(AvailabilityWindowRow).where(AvailabilityWindowRow.employee_id == employee.id))
        .scalars()
        .all()
    )
    return [
        AvailabilityWindow(
            weekday=row.weekday,
            time_from=row.time_from,
            time_to=row.time_to,
            open_for_extra=row.open_for_extra,
        )
        for row in rows
    ]


@router.put("/me/availability", response_model=list[AvailabilityWindow])
def set_my_availability(
    payload: list[AvailabilityWindow],
    employee: Employee = Depends(get_current_employee),
    db: Session = Depends(get_db),
) -> list[AvailabilityWindow]:
    """Полностью заменяет окна доступности сотрудника (openapi.yaml: `/me/availability` put)."""
    db.execute(delete(AvailabilityWindowRow).where(AvailabilityWindowRow.employee_id == employee.id))
    for window in payload:
        db.add(
            AvailabilityWindowRow(
                employee_id=employee.id,
                weekday=window.weekday.value,
                time_from=window.time_from,
                time_to=window.time_to,
                open_for_extra=window.open_for_extra,
            )
        )
    db.commit()
    return payload
