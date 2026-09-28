from __future__ import annotations

from fastapi import APIRouter, Depends

from ..auth import get_current_employee
from ..db_models import Employee
from ..schemas import LeaveBalance, Me

router = APIRouter(tags=["Me"])


@router.get("/me", response_model=Me)
def get_me(employee: Employee = Depends(get_current_employee)) -> Me:
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
