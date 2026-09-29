from __future__ import annotations

from datetime import date, datetime

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..audit import record as record_audit
from ..audit_view import build_history
from ..auth import get_current_employee
from ..db import get_db
from ..db_models import Document, Employee, LeaveRequest
from ..errors import conflict, forbidden, not_found
from ..files import build_pdf_url
from ..schemas import DocumentDetail, DocumentRegistryEntry, SignDocumentRequest, Signer
from ..util import parse_uuid_or_404

router = APIRouter(tags=["Documents"])

_REGISTRY_ROLES = {"accountant", "manager", "admin"}
# order_t6 требует подписи в этом порядке: сначала руководитель, потом
# сотрудник (README §7 шаг 5) — остальные виды документов требуют только
# подписи самого сотрудника (или вообще не требуют — application).
_ORDER_T6_MANAGER_FIRST = "order_t6"


@router.get("/documents/{document_id}", response_model=DocumentDetail)
def get_document(
    document_id: str,
    request: Request,
    employee: Employee = Depends(get_current_employee),
    db: Session = Depends(get_db),
) -> DocumentDetail:
    document = db.get(Document, parse_uuid_or_404(document_id, "Документ не найден"))
    if document is None:
        raise not_found("Документ не найден")

    leave_request = db.get(LeaveRequest, document.request_id)

    is_owner = leave_request is not None and leave_request.employee_id == employee.id
    is_manager_same_location = (
        "manager" in employee.roles
        and leave_request is not None
        and leave_request.employee.location_id == employee.location_id
    )
    is_back_office = bool({"accountant", "admin"} & set(employee.roles))
    if not (is_owner or is_manager_same_location or is_back_office):
        raise forbidden("Этот документ вам недоступен")

    base_url = str(request.base_url).rstrip("/")
    return DocumentDetail(
        id=document.id,
        kind=document.kind,
        number=document.number,
        request_id=document.request_id,
        status=document.status,
        issued_at=document.issued_at,
        signers=[Signer(**s) for s in document.signers],
        pdf_url=build_pdf_url(base_url, str(document.id)),
        sha256=document.sha256,
        integrity_verified=True,
        history=build_history(db, entity="leave_request", entity_id=document.request_id),
    )


@router.get("/documents", response_model=list[DocumentRegistryEntry])
def list_documents(
    status: str | None = Query(default=None),
    kind: str | None = Query(default=None),
    from_: date | None = Query(default=None, alias="from"),
    to: date | None = Query(default=None),
    employee: Employee = Depends(get_current_employee),
    db: Session = Depends(get_db),
) -> list[DocumentRegistryEntry]:
    """GAP-03: реестр документов всей компании (не одной точки) — бухгалтер
    ведёт документооборот по всем точкам сразу."""
    if not _REGISTRY_ROLES & set(employee.roles):
        raise forbidden("Реестр документов доступен руководителю, бухгалтеру и администратору")

    stmt = (
        select(Document)
        .join(LeaveRequest, LeaveRequest.id == Document.request_id)
        .join(Employee, Employee.id == LeaveRequest.employee_id)
        .where(Employee.company_id == employee.company_id)
        .order_by(Document.issued_at.desc())
    )
    if status:
        stmt = stmt.where(Document.status == status)
    if kind:
        stmt = stmt.where(Document.kind == kind)
    if from_:
        stmt = stmt.where(Document.issued_at >= from_)
    if to:
        stmt = stmt.where(Document.issued_at <= to)

    rows = db.execute(stmt).scalars().all()
    return [
        DocumentRegistryEntry(
            id=d.id,
            kind=d.kind,
            number=d.number,
            request_id=d.request_id,
            status=d.status,
            issued_at=d.issued_at,
            signers=[Signer(**s) for s in d.signers],
            owner_name=d.leave_request.employee.full_name if d.leave_request else "—",
        )
        for d in rows
    ]


@router.post("/documents/{document_id}/sign", response_model=DocumentDetail)
def sign_document(
    document_id: str,
    payload: SignDocumentRequest,
    request: Request,
    employee: Employee = Depends(get_current_employee),
    db: Session = Depends(get_db),
) -> DocumentDetail:
    """GAP-01: биометрия/подтверждение — локальный результат MAX Bridge,
    это подтверждение того результата на бэкенде: добавляет подписанта и,
    когда все обязательные подписи собраны, переводит documents.status в
    signed (см. mockApi.ts:signDocument — та же логика, перенесённая 1:1)."""
    document = db.get(Document, parse_uuid_or_404(document_id, "Документ не найден"))
    if document is None:
        raise not_found("Документ не найден")

    leave_request = db.get(LeaveRequest, document.request_id)
    is_owner = leave_request is not None and leave_request.employee_id == employee.id
    is_manager_same_location = (
        "manager" in employee.roles and leave_request is not None and leave_request.employee.location_id == employee.location_id
    )
    if not (is_owner or is_manager_same_location):
        raise forbidden("Вы не можете подписать этот документ")

    signers = list(document.signers)
    existing_idx = next((i for i, s in enumerate(signers) if s.get("employeeId") == str(employee.id)), None)
    if existing_idx is not None and signers[existing_idx].get("signedAt"):
        return _document_detail(request, db, document)  # идемпотентно — уже подписал

    if document.kind == _ORDER_T6_MANAGER_FIRST and "manager" not in employee.roles:
        manager_signed = any(s.get("role") == "manager" and s.get("signedAt") for s in signers)
        if not manager_signed:
            raise conflict("Сначала документ должен подписать руководитель")

    signed_at = datetime.utcnow()
    signer_row = {
        "employeeId": str(employee.id),
        "fullName": employee.full_name,
        "role": "manager" if "manager" in employee.roles else "employee",
        "signedAt": signed_at.isoformat(),
        "method": payload.method.value,
    }
    if existing_idx is not None:
        signers[existing_idx] = signer_row
    else:
        signers.append(signer_row)

    if document.kind == _ORDER_T6_MANAGER_FIRST and "manager" in employee.roles:
        # Руководитель подписал первым — очередь сотрудника, документ пока не signed.
        if leave_request is not None and not any(s.get("employeeId") == str(leave_request.employee_id) for s in signers):
            signers.append(
                {
                    "employeeId": str(leave_request.employee_id),
                    "fullName": leave_request.employee.full_name,
                    "role": "employee",
                    "signedAt": None,
                    "method": None,
                }
            )
        document.status = "to_sign"
    else:
        document.status = "signed"

    document.signers = signers
    db.flush()

    record_audit(
        db,
        actor_id=employee.id,
        actor_name=employee.full_name,
        entity="document",
        entity_id=document.id,
        action="sign",
        from_status="to_sign",
        to_status=document.status,
        method=payload.method.value,
    )
    db.commit()
    db.refresh(document)
    return _document_detail(request, db, document)


def _document_detail(request: Request, db: Session, document: Document) -> DocumentDetail:
    base_url = str(request.base_url).rstrip("/")
    return DocumentDetail(
        id=document.id,
        kind=document.kind,
        number=document.number,
        request_id=document.request_id,
        status=document.status,
        issued_at=document.issued_at,
        signers=[Signer(**s) for s in document.signers],
        pdf_url=build_pdf_url(base_url, str(document.id)),
        sha256=document.sha256,
        integrity_verified=True,
        history=build_history(db, entity="leave_request", entity_id=document.request_id),
    )
