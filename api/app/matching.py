from __future__ import annotations

from datetime import datetime
from typing import TypedDict

from sqlalchemy import select
from sqlalchemy.orm import Session

from .db_models import AvailabilityWindow, Employee, LeaveRequest, Shift, ShiftOffer

_WEEKDAY_CODES = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
_WEEKDAY_LABELS = {"mon": "пн", "tue": "вт", "wed": "ср", "thu": "чт", "fri": "пт", "sat": "сб", "sun": "вс"}

_ACTIVE_LEAVE_STATUSES = ("pending", "approved", "active")


class ScoredCandidate(TypedDict):
    employee: Employee
    score: float
    reasons: list[str]


def score_candidates(db: Session, shift: Shift) -> list[ScoredCandidate]:
    """score_candidate() — по доступности/расстоянию/истории смен, без фото/возраста/пола
    (README §7 шаг 6 и §8): те данные попросту не читаются из БД в этой функции.
    """
    exclude_employee_id = None
    if shift.source_request_id is not None:
        source_request = db.get(LeaveRequest, shift.source_request_id)
        if source_request is not None:
            exclude_employee_id = source_request.employee_id

    weekday_code = _WEEKDAY_CODES[shift.starts_at.weekday()]
    shift_from = shift.starts_at.strftime("%H:%M")
    shift_to = shift.ends_at.strftime("%H:%M")

    employees = db.execute(select(Employee).where(Employee.location_id == shift.location_id)).scalars().all()

    candidates: list[ScoredCandidate] = []
    for employee in employees:
        if employee.id == exclude_employee_id:
            continue

        # Квалификация/допуски (README §7 шаг 6: «по квалификации, допускам,
        # окнам доступности, расстоянию, истории выходов» — не по фото/симпатии).
        if employee.position != shift.role_required:
            continue
        if shift.skills_required and not set(shift.skills_required) <= set(employee.skills or []):
            continue

        windows = db.execute(
            select(AvailabilityWindow).where(
                AvailabilityWindow.employee_id == employee.id,
                AvailabilityWindow.weekday == weekday_code,
                AvailabilityWindow.open_for_extra.is_(True),
            )
        ).scalars().all()
        window = next((w for w in windows if w.time_from <= shift_from and w.time_to >= shift_to), None)
        if window is None:
            continue
        if _has_conflict(db, employee.id, shift.starts_at, shift.ends_at):
            continue

        score = 40.0
        reasons = [f"Свободен {_WEEKDAY_LABELS[weekday_code]} {window.time_from}–{window.time_to}"]
        if shift.skills_required:
            reasons.append("Должность и допуски совпадают")

        if employee.distance_km is not None:
            score += max(0.0, 20.0 - employee.distance_km * 4.0)
            reasons.append(f"{employee.distance_km:g} км от точки")

        score += min(employee.shifts_completed, 10)
        if employee.shifts_no_show:
            score -= 10 * employee.shifts_no_show
            reasons.append(f"{employee.shifts_completed} подтверждённых смен, {employee.shifts_no_show} неявок")
        else:
            reasons.append(f"{employee.shifts_completed} подтверждённых смен, ни одной неявки")

        candidates.append({"employee": employee, "score": round(score, 1), "reasons": reasons})

    candidates.sort(key=lambda c: c["score"], reverse=True)
    return candidates


def _has_conflict(db: Session, employee_id, starts_at: datetime, ends_at: datetime) -> bool:
    overlapping_leave = db.execute(
        select(LeaveRequest).where(
            LeaveRequest.employee_id == employee_id,
            LeaveRequest.status.in_(_ACTIVE_LEAVE_STATUSES),
            LeaveRequest.start_date <= ends_at.date(),
            LeaveRequest.end_date >= starts_at.date(),
        )
    ).first()
    if overlapping_leave is not None:
        return True

    overlapping_offer = db.execute(
        select(ShiftOffer)
        .join(Shift, Shift.id == ShiftOffer.shift_id)
        .where(
            ShiftOffer.employee_id == employee_id,
            ShiftOffer.status == "accepted",
            Shift.starts_at < ends_at,
            Shift.ends_at > starts_at,
        )
    ).first()
    return overlapping_offer is not None
