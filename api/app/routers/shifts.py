from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..audit import record as record_audit
from ..auth import get_current_employee
from ..db import get_db
from ..db_models import Employee, Shift as ShiftRow
from ..db_models import ShiftOffer as ShiftOfferRow
from ..errors import already_resolved, forbidden, not_found
from ..matching import score_candidates
from ..notify_client import notify_shift_offer_declined, notify_shift_offer_proposed
from ..schemas import CreateShiftOfferRequest, CreateShiftRequest, Shift, ShiftCandidate
from ..schemas import ShiftOffer as ShiftOfferDTO
from ..util import parse_uuid_or_404

router = APIRouter(tags=["Shifts"])


def _require_manager(employee: Employee) -> None:
    if "manager" not in employee.roles:
        raise forbidden("Подбор подмен доступен только руководителю")


def _to_offer_dto(offer: ShiftOfferRow) -> ShiftOfferDTO:
    return ShiftOfferDTO(
        id=offer.id,
        shift_id=offer.shift_id,
        employee_id=offer.employee_id,
        score=offer.score,
        reasons=offer.reasons,
        status=offer.status,
        created_at=offer.created_at,
    )


def _to_shift_dto(shift: ShiftRow) -> Shift:
    return Shift(
        id=shift.id,
        location_id=shift.location_id,
        starts_at=shift.starts_at,
        ends_at=shift.ends_at,
        role_required=shift.role_required,
        skills_required=shift.skills_required,
        status=shift.status,
        source_request_id=shift.source_request_id,
    )


@router.get("/shifts", response_model=list[Shift])
def list_shifts(
    status: str | None = Query(default=None),
    employee: Employee = Depends(get_current_employee),
    db: Session = Depends(get_db),
) -> list[Shift]:
    """Экран «Открытые смены» (Team.tsx) — без него Substitution был доступен
    только по хардкоду shift-1, реальные смены (заведённые при согласовании
    отпуска, №19) найти было неоткуда."""
    _require_manager(employee)
    stmt = select(ShiftRow).where(ShiftRow.location_id == employee.location_id).order_by(ShiftRow.starts_at)
    if status:
        stmt = stmt.where(ShiftRow.status == status)
    rows = db.execute(stmt).scalars().all()
    return [_to_shift_dto(row) for row in rows]


@router.post("/shifts", response_model=Shift, status_code=201)
def create_shift(
    payload: CreateShiftRequest,
    employee: Employee = Depends(get_current_employee),
    db: Session = Depends(get_db),
) -> Shift:
    _require_manager(employee)
    shift = ShiftRow(
        location_id=employee.location_id,
        starts_at=payload.starts_at,
        ends_at=payload.ends_at,
        role_required=payload.role_required,
        skills_required=payload.skills_required,
        status="open",
    )
    db.add(shift)
    db.commit()
    db.refresh(shift)
    return _to_shift_dto(shift)


@router.get("/shifts/{shift_id}/candidates", response_model=list[ShiftCandidate])
def list_shift_candidates(
    shift_id: str,
    employee: Employee = Depends(get_current_employee),
    db: Session = Depends(get_db),
) -> list[ShiftCandidate]:
    _require_manager(employee)
    shift = db.get(ShiftRow, parse_uuid_or_404(shift_id, "Смена не найдена"))
    if shift is None or shift.location_id != employee.location_id:
        raise not_found("Смена не найдена")

    return [
        ShiftCandidate(
            employee_id=c["employee"].id,
            full_name=c["employee"].full_name,
            position=c["employee"].position,
            score=c["score"],
            reasons=c["reasons"],
        )
        for c in score_candidates(db, shift)
    ]


@router.post("/shift-offers", response_model=ShiftOfferDTO, status_code=201)
def create_shift_offer(
    payload: CreateShiftOfferRequest,
    employee: Employee = Depends(get_current_employee),
    db: Session = Depends(get_db),
) -> ShiftOfferDTO:
    _require_manager(employee)
    shift = db.get(ShiftRow, payload.shift_id)
    if shift is None or shift.location_id != employee.location_id:
        raise not_found("Смена не найдена")

    scored = {c["employee"].id: c for c in score_candidates(db, shift)}
    match = scored.get(payload.employee_id)

    offer = ShiftOfferRow(
        shift_id=shift.id,
        employee_id=payload.employee_id,
        score=match["score"] if match else 0.0,
        reasons=match["reasons"] if match else [],
        status="proposed",
    )
    db.add(offer)
    shift.status = "offered"
    db.flush()

    record_audit(
        db,
        actor_id=employee.id,
        actor_name=employee.full_name,
        entity="shift_offer",
        entity_id=offer.id,
        action="propose",
        from_status=None,
        to_status="proposed",
    )
    db.commit()
    db.refresh(offer)

    candidate = db.get(Employee, offer.employee_id)
    if candidate is not None:
        notify_shift_offer_proposed(
            candidate_max_user_id=candidate.max_user_id,
            offer_id=str(offer.id),
            location_name=candidate.location.name if candidate.location else None,
            score=offer.score,
            reasons=offer.reasons,
        )

    return _to_offer_dto(offer)


@router.get("/shift-offers/{offer_id}", response_model=ShiftOfferDTO)
def get_shift_offer(
    offer_id: str,
    employee: Employee = Depends(get_current_employee),
    db: Session = Depends(get_db),
) -> ShiftOfferDTO:
    """Не входит в 16 путей openapi.yaml, но помечена в контракте (§1) как
    «Рекомендация»: экран «Предложение смены» открывается по deeplink
    `off_<id>` и без этого эндпоинта ему неоткуда взять данные — в отличие
    от GAP'ов, тут нет решения, которое требует команда, схема уже есть
    (components.schemas.ShiftOffer)."""
    offer = db.get(ShiftOfferRow, parse_uuid_or_404(offer_id, "Предложение не найдено"))
    if offer is None:
        raise not_found("Предложение не найдено")
    shift = db.get(ShiftRow, offer.shift_id)
    is_target = offer.employee_id == employee.id
    is_manager_same_location = (
        "manager" in employee.roles and shift is not None and shift.location_id == employee.location_id
    )
    if not (is_target or is_manager_same_location):
        raise forbidden("Это предложение вам недоступно")
    return _to_offer_dto(offer)


@router.post("/shift-offers/{offer_id}/accept", response_model=ShiftOfferDTO)
def accept_shift_offer(
    offer_id: str,
    employee: Employee = Depends(get_current_employee),
    db: Session = Depends(get_db),
) -> ShiftOfferDTO:
    offer = db.get(ShiftOfferRow, parse_uuid_or_404(offer_id, "Предложение не найдено"))
    if offer is None:
        raise not_found("Предложение не найдено")
    if offer.employee_id != employee.id:
        raise forbidden("Это предложение адресовано не вам")

    if offer.status == "accepted":
        return _to_offer_dto(offer)  # идемпотентно, см. openapi.yaml responses.AlreadyResolved
    if offer.status != "proposed":
        raise already_resolved("Предложение уже обработано")

    offer.status = "accepted"
    shift = db.get(ShiftRow, offer.shift_id)
    if shift is not None:
        shift.status = "filled"
    db.flush()

    record_audit(
        db,
        actor_id=employee.id,
        actor_name=employee.full_name,
        entity="shift_offer",
        entity_id=offer.id,
        action="accept",
        from_status="proposed",
        to_status="accepted",
    )
    db.commit()
    db.refresh(offer)
    return _to_offer_dto(offer)


@router.post("/shift-offers/{offer_id}/decline", response_model=ShiftOfferDTO)
def decline_shift_offer(
    offer_id: str,
    employee: Employee = Depends(get_current_employee),
    db: Session = Depends(get_db),
) -> ShiftOfferDTO:
    """GAP-05: «Не смогу» — симметрично accept. Смена возвращается в open,
    чтобы руководитель мог предложить её следующему кандидату."""
    offer = db.get(ShiftOfferRow, parse_uuid_or_404(offer_id, "Предложение не найдено"))
    if offer is None:
        raise not_found("Предложение не найдено")
    if offer.employee_id != employee.id:
        raise forbidden("Это предложение адресовано не вам")

    if offer.status == "declined":
        return _to_offer_dto(offer)  # идемпотентно
    if offer.status != "proposed":
        raise already_resolved("Предложение уже обработано")

    offer.status = "declined"
    shift = db.get(ShiftRow, offer.shift_id)
    if shift is not None:
        shift.status = "open"
    db.flush()

    record_audit(
        db,
        actor_id=employee.id,
        actor_name=employee.full_name,
        entity="shift_offer",
        entity_id=offer.id,
        action="decline",
        from_status="proposed",
        to_status="declined",
    )
    db.commit()
    db.refresh(offer)

    managers = db.execute(
        select(Employee).where(
            Employee.location_id == employee.location_id,
            Employee.roles.any("manager"),
        )
    ).scalars().all()
    for manager in managers:
        notify_shift_offer_declined(
            manager_max_user_id=manager.max_user_id,
            offer_id=str(offer.id),
            candidate_full_name=employee.full_name,
        )

    return _to_offer_dto(offer)
