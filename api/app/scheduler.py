from __future__ import annotations

import logging
from datetime import date, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from .db_models import Employee, LeaveRequest
from .notify_client import (
    notify_accountant_pay_reminder,
    notify_employee_leave_reminder,
    notify_employee_welcome_back,
    notify_manager_escalation,
)

logger = logging.getLogger(__name__)

# Насколько заранее эскалировать руководителю ещё не решённую заявку —
# не из README дословно, а прямое следствие ст. 123 ТК РФ: если до
# notify_deadline (сама по себе — ст. 123) осталось мало времени, а заявка
# всё ещё pending, компания рискует не уложиться в двухнедельный срок.
MANAGER_ESCALATION_WINDOW_DAYS = 3


def _employees_by_role(db: Session, location_id, role: str) -> list[Employee]:
    return (
        db.execute(
            select(Employee).where(Employee.location_id == location_id, Employee.roles.any(role))
        )
        .scalars()
        .all()
    )


def _remind_employees(db: Session, today: date) -> int:
    """README §9 №13: «за 14 дней — известить работника»."""
    rows = (
        db.execute(
            select(LeaveRequest).where(
                LeaveRequest.status == "approved",
                LeaveRequest.notify_deadline <= today,
                LeaveRequest.employee_reminder_sent_at.is_(None),
            )
        )
        .scalars()
        .all()
    )
    for leave_request in rows:
        notify_employee_leave_reminder(
            employee_max_user_id=leave_request.employee.max_user_id,
            request_id=str(leave_request.id),
            start_date=leave_request.start_date.isoformat(),
            end_date=leave_request.end_date.isoformat(),
        )
        leave_request.employee_reminder_sent_at = datetime.utcnow()
    return len(rows)


def _remind_accountants(db: Session, today: date) -> int:
    """README §9 №13: «за 3 дня — выплатить отпускные»."""
    rows = (
        db.execute(
            select(LeaveRequest).where(
                LeaveRequest.status == "approved",
                LeaveRequest.pay_deadline <= today,
                LeaveRequest.accountant_reminder_sent_at.is_(None),
            )
        )
        .scalars()
        .all()
    )
    for leave_request in rows:
        accountants = _employees_by_role(db, leave_request.employee.location_id, "accountant")
        for accountant in accountants:
            notify_accountant_pay_reminder(
                accountant_max_user_id=accountant.max_user_id,
                request_id=str(leave_request.id),
                employee_full_name=leave_request.employee.full_name,
                pay_deadline=leave_request.pay_deadline.isoformat(),
            )
        leave_request.accountant_reminder_sent_at = datetime.utcnow()
    return len(rows)


def _escalate_pending(db: Session, today: date) -> int:
    """Заявка ещё pending, а до notify_deadline (ст. 123 ТК РФ) осталось
    мало — напомнить руководителю решить, пока компания не нарушила срок."""
    threshold = today + timedelta(days=MANAGER_ESCALATION_WINDOW_DAYS)
    rows = (
        db.execute(
            select(LeaveRequest).where(
                LeaveRequest.status == "pending",
                LeaveRequest.notify_deadline <= threshold,
                LeaveRequest.manager_escalation_sent_at.is_(None),
            )
        )
        .scalars()
        .all()
    )
    for leave_request in rows:
        managers = _employees_by_role(db, leave_request.employee.location_id, "manager")
        for manager in managers:
            notify_manager_escalation(
                manager_max_user_id=manager.max_user_id,
                request_id=str(leave_request.id),
                employee_full_name=leave_request.employee.full_name,
                notify_deadline=leave_request.notify_deadline.isoformat(),
            )
        leave_request.manager_escalation_sent_at = datetime.utcnow()
    return len(rows)


def _close_finished_leaves(db: Session, today: date) -> int:
    """README §9 №13: «в день выхода — закрыть» — approved -> completed на
    следующий день после end_date, с приветственным сообщением сотруднику."""
    rows = (
        db.execute(
            select(LeaveRequest).where(LeaveRequest.status == "approved", LeaveRequest.end_date < today)
        )
        .scalars()
        .all()
    )
    for leave_request in rows:
        leave_request.status = "completed"
        notify_employee_welcome_back(
            employee_max_user_id=leave_request.employee.max_user_id,
            request_id=str(leave_request.id),
        )
    return len(rows)


def run_reminder_sweep(db: Session) -> None:
    """Один проход планировщика — вызывается периодически из main.py.
    Идемпотентно: каждая заявка получает каждое напоминание максимум один
    раз (см. *_sent_at поля), поэтому безопасно звать чаще, чем нужно."""
    today = date.today()
    counts = {
        "employee_reminders": _remind_employees(db, today),
        "accountant_reminders": _remind_accountants(db, today),
        "manager_escalations": _escalate_pending(db, today),
        "closed_leaves": _close_finished_leaves(db, today),
    }
    db.commit()
    if any(counts.values()):
        logger.info("Проход планировщика напоминаний: %s", counts)
    else:
        logger.debug("Проход планировщика напоминаний: нечего отправлять")
