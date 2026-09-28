from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from .db_models import AuditLog
from .schemas import HistoryEvent


def build_history(db: Session, *, entity: str, entity_id: uuid.UUID) -> list[HistoryEvent]:
    """`LeaveRequestDetail.history` / `DocumentDetail.history` — derived from the same
    audit_log rows that back the global `/audit` journal, single source of truth."""
    rows = db.execute(
        select(AuditLog)
        .where(AuditLog.entity == entity, AuditLog.entity_id == entity_id)
        .order_by(AuditLog.occurred_at.asc())
    ).scalars().all()
    return [
        HistoryEvent(
            occurred_at=row.occurred_at,
            action=row.action,
            from_status=row.from_status,
            to_status=row.to_status,
            actor_id=row.actor_id,
            actor_name=row.actor_name,
            method=row.method,
        )
        for row in rows
    ]
