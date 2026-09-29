from __future__ import annotations

import hashlib
from datetime import timedelta
from pathlib import Path

import yaml

from .calculation import Calculation, calculate
from .checks import CHECK_REGISTRY
from .context import EmployeeContext, LeaveRequestContext, TeamOverlap
from .models import CheckResult, CheckSeverity, DateRange, Rule, Verdict, VerdictLevel

DEFAULT_RULES_PATH = Path(__file__).resolve().parent / "data" / "rules.yaml"


class RulesEngine:
    """Facade over the ТК РФ rules справочник: load rules, evaluate a leave request, suggest a fix.

    Rules live as data (YAML), not code — updating a norm's text or deadline
    never requires a release, matching the architecture decision in README §11/§16.
    """

    def __init__(self, rules_path: Path | str = DEFAULT_RULES_PATH) -> None:
        self._rules_path = Path(rules_path)
        self._rules: list[Rule] = []
        self._version: str = ""
        self.reload()

    def reload(self) -> None:
        raw = self._rules_path.read_bytes()
        self._version = hashlib.sha256(raw).hexdigest()[:8]
        data = yaml.safe_load(raw) or []
        self._rules = [Rule.model_validate(item) for item in data]

    @property
    def rules_version(self) -> str:
        return self._version

    def list_rules(self) -> list[Rule]:
        return list(self._rules)

    def evaluate(self, employee: EmployeeContext, request: LeaveRequestContext) -> Verdict:
        calc = calculate(employee, request)
        checks = self._run_checks(employee, request, calc)
        level = self._resolve_level(checks)
        suggestion = self._suggest(level, request, calc, checks)

        return Verdict(
            level=level,
            calendar_days=calc.calendar_days,
            chargeable_days=calc.chargeable_days,
            balance_after=calc.balance_after,
            notify_by=calc.notify_by,
            pay_by=calc.pay_by,
            checks=checks,
            suggestion=suggestion,
            rules_version=self._version,
        )

    def _run_checks(
        self,
        employee: EmployeeContext,
        request: LeaveRequestContext,
        calc: Calculation,
    ) -> list[CheckResult]:
        results: list[CheckResult] = []
        for rule in self._rules:
            handler = CHECK_REGISTRY.get(rule.check)
            if handler is None:
                raise KeyError(f"Unknown check '{rule.check}' for rule '{rule.id}'")
            outcome = handler(rule, employee, request, calc)
            if outcome is None:
                continue
            results.append(
                CheckResult(
                    rule_id=rule.id,
                    type=rule.type,
                    passed=outcome.passed,
                    severity=rule.severity,
                    message=outcome.message,
                    norm=rule.norm,
                    checked_at=rule.checked_at,
                )
            )
        return results

    @staticmethod
    def _resolve_level(checks: list[CheckResult]) -> VerdictLevel:
        if any(not c.passed and c.severity == CheckSeverity.BLOCK for c in checks):
            return VerdictLevel.RED
        if any(not c.passed and c.severity == CheckSeverity.WARN for c in checks):
            return VerdictLevel.YELLOW
        return VerdictLevel.GREEN

    @staticmethod
    def _suggest(
        level: VerdictLevel,
        request: LeaveRequestContext,
        calc: Calculation,
        checks: list[CheckResult],
    ) -> DateRange | None:
        if level != VerdictLevel.RED:
            return None

        notice_failed = any(not c.passed and c.rule_id == "tk.123.notice" for c in checks)
        if notice_failed:
            duration = (request.end_date - request.start_date).days
            new_start = request.as_of_today() + timedelta(days=14)
            new_end = new_start + timedelta(days=duration)
            return DateRange(start_date=new_start, end_date=new_end)

        balance_failed = any(not c.passed and c.rule_id == "tk.115.balance" for c in checks)
        if balance_failed:
            # Сдвигать даты бессмысленно — не хватает не времени, а дней.
            # Предлагаем тот же старт, но урезанный период на весь доступный
            # остаток (без праздников — holidays_in_range пересчитает точнее,
            # но для укороченного периода это достаточно честная оценка).
            available_days = int(calc.balance_after + calc.chargeable_days)
            if available_days < 14:
                return None  # короче 14 дней предложить нечего (ст. 125 ТК РФ)
            new_end = request.start_date + timedelta(days=available_days - 1)
            return DateRange(start_date=request.start_date, end_date=new_end)

        return None


__all__ = [
    "RulesEngine",
    "EmployeeContext",
    "LeaveRequestContext",
    "TeamOverlap",
    "Verdict",
    "CheckResult",
    "Rule",
    "VerdictLevel",
    "CheckSeverity",
]
