from __future__ import annotations

from datetime import date

from pydantic import BaseModel, Field

from .models import DateRange


class TeamOverlap(BaseModel):
    """One colleague's occupied period — as returned by `GET /team/calendar`."""

    employee_id: str
    full_name: str
    start_date: date
    end_date: date


class EmployeeContext(BaseModel):
    """Everything the rules engine needs to know about the requester.

    Deliberately decoupled from any ORM/DB model so the engine stays testable
    and reusable before the API/DB layer exists.
    """

    id: str
    full_name: str
    hire_date: date
    leave_balance_days: float
    balance_as_of: date
    category: str | None = None
    last_leave_end_date: date | None = None
    approved_leave_parts_this_year: list[int] = Field(default_factory=list)
    # №24: утверждённый график Т-7 на год запрашиваемого отпуска — None, если
    # для этого года график ещё не утверждён (см. routers/schedule_t7.py).
    approved_schedule: DateRange | None = None


class LeaveRequestContext(BaseModel):
    start_date: date
    end_date: date
    team_overlaps: list[TeamOverlap] = Field(default_factory=list)
    today: date | None = None

    def as_of_today(self) -> date:
        return self.today or date.today()
