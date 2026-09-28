from __future__ import annotations

import hashlib
import json
import uuid
from datetime import date, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from .db_models import AuditLog


def _serialize(value: object) -> object:
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, uuid.UUID):
        return str(value)
    return value


def record(
    db: Session,
    *,
    actor_id: uuid.UUID,
    actor_name: str,
    entity: str,
    entity_id: uuid.UUID,
    action: str,
    from_status: str | None,
    to_status: str | None,
    method: str | None = None,
) -> AuditLog:
    """Добавляет запись в аппенд-онли журнал согласований (README §9, №9): каждая
    запись хеширует предыдущую — подмена задним числом ломает цепочку.
    """
    prev = db.execute(select(AuditLog).order_by(AuditLog.occurred_at.desc()).limit(1)).scalar_one_or_none()
    prev_hash = prev.hash if prev else None
    occurred_at = datetime.utcnow()
    payload = {
        "occurredAt": _serialize(occurred_at),
        "actorId": _serialize(actor_id),
        "entity": entity,
        "entityId": _serialize(entity_id),
        "action": action,
        "fromStatus": from_status,
        "toStatus": to_status,
        "method": method,
        "prevHash": prev_hash,
    }
    digest = hashlib.sha256(json.dumps(payload, sort_keys=True, ensure_ascii=False).encode("utf-8")).hexdigest()
    entry = AuditLog(
        occurred_at=occurred_at,
        actor_id=actor_id,
        actor_name=actor_name,
        entity=entity,
        entity_id=entity_id,
        action=action,
        from_status=from_status,
        to_status=to_status,
        method=method,
        hash=digest,
        prev_hash=prev_hash,
    )
    db.add(entry)
    db.flush()
    return entry
