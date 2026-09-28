from __future__ import annotations

from fastapi import APIRouter, Depends

from ..auth import get_current_employee
from ..db_models import Employee
from ..rules import Rule
from ..rules_engine_instance import rules_engine

router = APIRouter(tags=["Rules"])


@router.get("/rules", response_model=list[Rule])
def list_rules(employee: Employee = Depends(get_current_employee)) -> list[Rule]:
    return rules_engine.list_rules()
