from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import get_current_employee
from ..db import get_db
from ..db_models import Employee, LeaveRequest
from ..schemas import TeamCalendarEntry

router = APIRouter(tags=["Team"])

_OCCUPYING_STATUSES = ("pending", "approved", "active")


@router.get("/team/calendar", response_model=list[TeamCalendarEntry])
def get_team_calendar(
    from_: date = Query(..., alias="from"),
    to: date = Query(...),
    employee: Employee = Depends(get_current_employee),
    db: Session = Depends(get_db),
) -> list[TeamCalendarEntry]:
    rows = db.execute(
        select(LeaveRequest)
        .join(Employee, Employee.id == LeaveRequest.employee_id)
        .where(
            Employee.location_id == employee.location_id,
            LeaveRequest.status.in_(_OCCUPYING_STATUSES),
            LeaveRequest.start_date <= to,
            LeaveRequest.end_date >= from_,
        )
    ).scalars().all()
    return [
        TeamCalendarEntry(
            employee_id=row.employee_id,
            full_name=row.employee.full_name,
            start_date=row.start_date,
            end_date=row.end_date,
        )
        for row in rows
    ]
