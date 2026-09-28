from __future__ import annotations

from datetime import date
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field


def to_camel(name: str) -> str:
    head, *tail = name.split("_")
    return head + "".join(word.capitalize() for word in tail)


class CamelModel(BaseModel):
    """Base for DTOs that mirror the OpenAPI contract (snake_case in Python, camelCase on the wire)."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class Role(str, Enum):
    EMPLOYEE = "employee"
    MANAGER = "manager"
    ACCOUNTANT = "accountant"
    ADMIN = "admin"


class VerdictLevel(str, Enum):
    GREEN = "green"
    YELLOW = "yellow"
    RED = "red"


class CheckSeverity(str, Enum):
    BLOCK = "block"
    WARN = "warn"
    INFO = "info"


class CheckType(str, Enum):
    LAW = "law"
    CALCULATION = "calculation"
    COMPANY = "company"


class Norm(CamelModel):
    title: str
    url: str


class CheckResult(CamelModel):
    rule_id: str
    type: CheckType
    passed: bool
    severity: CheckSeverity
    message: str
    norm: Norm | None = None
    checked_at: date


class DateRange(CamelModel):
    start_date: date
    end_date: date


class Verdict(CamelModel):
    level: VerdictLevel
    calendar_days: int
    chargeable_days: int
    balance_after: float
    notify_by: date
    pay_by: date
    checks: list[CheckResult]
    suggestion: DateRange | None = None
    rules_version: str


class RuleMessages(CamelModel):
    pass_: str = Field(alias="pass")
    fail: str


class Rule(CamelModel):
    id: str
    type: CheckType
    check: str
    severity: CheckSeverity
    params: dict = Field(default_factory=dict)
    norm: Norm
    effective_from: date
    checked_at: date
    messages: RuleMessages
