from __future__ import annotations

import io
import uuid
import zipfile
from datetime import date

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import get_current_employee
from ..config import settings
from ..db import get_db
from ..db_models import AuditLog, Employee, LeaveRequest
from ..errors import forbidden
from ..files import build_export_url
from ..schemas import AuditEntry, AuditExport

router = APIRouter(tags=["Audit"])

_AUDIT_ROLES = {"accountant", "manager", "admin"}


def _require_audit_access(employee: Employee) -> None:
    if not _AUDIT_ROLES & set(employee.roles):
        raise forbidden("Журнал доступен руководителю, бухгалтеру и администратору")


@router.get("/audit", response_model=list[AuditEntry])
def list_audit(
    request_id: str | None = Query(default=None),
    employee_id: str | None = Query(default=None),
    from_: date | None = Query(default=None, alias="from"),
    to: date | None = Query(default=None),
    employee: Employee = Depends(get_current_employee),
    db: Session = Depends(get_db),
) -> list[AuditEntry]:
    _require_audit_access(employee)
    stmt = select(AuditLog).order_by(AuditLog.occurred_at.desc())
    if request_id:
        try:
            stmt = stmt.where(AuditLog.entity_id == uuid.UUID(request_id))
        except ValueError:
            return []
    if employee_id:
        try:
            stmt = stmt.where(AuditLog.actor_id == uuid.UUID(employee_id))
        except ValueError:
            return []
    if from_:
        stmt = stmt.where(AuditLog.occurred_at >= from_)
    if to:
        stmt = stmt.where(AuditLog.occurred_at <= to)

    rows = db.execute(stmt).scalars().all()
    return [
        AuditEntry(
            occurred_at=row.occurred_at,
            actor_id=row.actor_id,
            actor_name=row.actor_name,
            entity=row.entity,
            entity_id=row.entity_id,
            action=row.action,
            from_status=row.from_status,
            to_status=row.to_status,
            method=row.method,
            hash=row.hash,
            prev_hash=row.prev_hash,
        )
        for row in rows
    ]


@router.get("/audit/export", response_model=AuditExport)
def export_audit_package(
    request: Request,
    from_: date = Query(..., alias="from"),
    to: date = Query(...),
    employee: Employee = Depends(get_current_employee),
    db: Session = Depends(get_db),
) -> AuditExport:
    """«Собрать папку к проверке» (README §7 шаг 5, УI MD раздел 6): PDF документов,
    журнал в CSV, сводка по каждому отпуску за период — в один ZIP.

    Раньше отдавали ZIP прямо в теле ответа, а фронтенд сам оборачивал его в
    blob:-ссылку (URL.createObjectURL) — она существует только в памяти
    текущего веб-вью, и реальный WebApp.downloadFile() в MAX не может её
    получить (отдаёт URL нативному загрузчику вне веб-вью). Поэтому сохраняем
    ZIP на диск и отдаём подписанную ссылку — тот же приём, что и для PDF
    документов (см. files.py build_pdf_url/build_export_url)."""
    _require_audit_access(employee)

    requests_in_range = db.execute(
        select(LeaveRequest).where(LeaveRequest.start_date >= from_, LeaveRequest.start_date <= to)
    ).scalars().all()
    audit_rows = db.execute(
        select(AuditLog)
        .where(AuditLog.occurred_at >= from_, AuditLog.occurred_at <= to)
        .order_by(AuditLog.occurred_at)
    ).scalars().all()

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        csv_lines = ["occurred_at,actor,entity,entity_id,action,from_status,to_status"]
        for row in audit_rows:
            csv_lines.append(
                f"{row.occurred_at.isoformat()},{row.actor_name},{row.entity},{row.entity_id},"
                f"{row.action},{row.from_status or ''},{row.to_status or ''}"
            )
        archive.writestr("journal.csv", "\n".join(csv_lines))

        summary_lines = [f"Период: {from_.isoformat()} — {to.isoformat()}", ""]
        for leave_request in requests_in_range:
            summary_lines.append(
                f"{leave_request.employee.full_name}: {leave_request.start_date} — {leave_request.end_date} "
                f"({leave_request.status})"
            )
            for document in leave_request.documents:
                if document.storage_path:
                    archive.write(document.storage_path, arcname=f"documents/{document.number}.pdf")
        archive.writestr("summary.txt", "\n".join(summary_lines))

    settings.files_dir.mkdir(parents=True, exist_ok=True)
    export_id = str(uuid.uuid4())
    export_path = settings.files_dir / f"{export_id}.zip"
    export_path.write_bytes(buffer.getvalue())

    base_url = str(request.base_url).rstrip("/")
    filename = f"audit-{from_}-{to}.zip"
    return AuditExport(url=build_export_url(base_url, export_id, filename), filename=filename)
