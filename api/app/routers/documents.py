from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from ..audit_view import build_history
from ..auth import get_current_employee
from ..db import get_db
from ..db_models import Document, Employee, LeaveRequest
from ..errors import forbidden, not_found
from ..files import build_pdf_url
from ..schemas import DocumentDetail, Signer
from ..util import parse_uuid_or_404

router = APIRouter(tags=["Documents"])


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
