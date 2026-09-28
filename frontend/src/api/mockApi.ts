import { getPersona } from '../context/authStore';
import {
  alreadyResolved,
  conflict,
  forbidden,
  notFound,
  notLinked,
  ruleViolation,
  validationError,
} from './errors';
import {
  AUDIT_LOG,
  AVAILABILITY,
  DOCUMENTS,
  EMPLOYEES,
  LEAVE_REQUESTS,
  LOCATION_NAME,
  ME_BY_ROLE,
  RULES,
  SHIFT_CANDIDATES,
  SHIFT_LEAVE_REQUEST,
  SHIFT_OFFERS,
  TEAM_CALENDAR,
  nextDocumentId,
  nextRequestId,
} from './fixtures';
import { delay } from './network';
import { computeVerdict, DEMO_TODAY } from './rulesEngine';
import type {
  ApproveLeaveRequest,
  AuditEntry,
  AvailabilityWindow,
  CreateShiftOfferRequest,
  DocumentDetail,
  Employee,
  LeaveRequestDetail,
  LeaveRequestSummary,
  Me,
  PreviewRequest,
  RejectLeaveRequest,
  Rule,
  ShiftCandidate,
  ShiftOffer,
  SubmitLeaveRequest,
  TeamCalendarEntry,
  Verdict,
} from './types';

function currentMe(): Me {
  const { role } = getPersona();
  return ME_BY_ROLE[role];
}

function requireLinked() {
  if (!getPersona().isLinked) throw notLinked();
}

function toSummary(detail: LeaveRequestDetail): LeaveRequestSummary {
  const { verdict: _verdict, history: _history, rejectReason: _r, replacesId: _rp, ...summary } = detail;
  return summary;
}

// ---- GET /me ----------------------------------------------------------
export async function getMe(): Promise<Me> {
  requireLinked();
  return delay(currentMe());
}

// ---- POST /leave-requests/preview -------------------------------------
export async function previewLeaveRequest(body: PreviewRequest): Promise<Verdict> {
  requireLinked();
  const me = currentMe();
  if (body.endDate < body.startDate) {
    throw validationError('Некорректные даты периода', [
      { field: 'endDate', issue: 'должна быть не раньше startDate' },
    ]);
  }
  const verdict = computeVerdict({
    startDate: body.startDate,
    endDate: body.endDate,
    leaveBalanceDays: me.leaveBalance.days,
    employeeId: me.id,
    teamCalendar: TEAM_CALENDAR,
  });
  return delay(verdict, 300);
}

// ---- GET /leave-requests?scope= ----------------------------------------
export async function listLeaveRequests(scope: 'mine' | 'inbox'): Promise<LeaveRequestSummary[]> {
  requireLinked();
  const me = currentMe();
  const all = Object.values(LEAVE_REQUESTS);

  if (scope === 'mine') {
    return delay(all.filter((r) => r.employee.id === me.id).map(toSummary));
  }

  if (!me.roles.includes('manager')) {
    throw forbidden('Входящие заявки доступны только руководителю');
  }
  return delay(
    all.filter((r) => r.employee.locationId === me.locationId && r.employee.id !== me.id).map(toSummary),
  );
}

// ---- POST /leave-requests ------------------------------------------------
export async function submitLeaveRequest(body: SubmitLeaveRequest): Promise<LeaveRequestDetail> {
  requireLinked();
  const me = currentMe();
  const verdict = computeVerdict({
    startDate: body.startDate,
    endDate: body.endDate,
    leaveBalanceDays: me.leaveBalance.days,
    employeeId: me.id,
    teamCalendar: TEAM_CALENDAR,
  });

  if (verdict.level === 'red') {
    const matchesSuggestion =
      verdict.suggestion &&
      body.startDate === verdict.suggestion.startDate &&
      body.endDate === verdict.suggestion.endDate;
    if (!matchesSuggestion) {
      throw ruleViolation('Вердикт красный: даты не совпадают с ближайшей допустимой');
    }
  }

  const id = nextRequestId();
  const employee = EMPLOYEES[me.id] ?? {
    id: me.id,
    fullName: me.fullName,
    position: me.position,
    locationId: me.locationId ?? '',
    locationName: me.locationName,
  };

  const now = new Date().toISOString();
  const applicationDocId = nextDocumentId();
  const applicationDoc: DocumentDetail = {
    id: applicationDocId,
    kind: 'application',
    number: `Заявление № ${applicationDocId.replace('doc-', '')}/2026`,
    requestId: id,
    // Submitting the request IS the employee's signature on the
    // application — no separate pending signer (see the doc-1 fixture note).
    status: 'formed',
    issuedAt: now,
    signers: [],
    pdfUrl: `https://example.org/demo/${applicationDocId}.pdf`,
    sha256: 'demo-hash',
    integrityVerified: true,
    history: [],
  };

  const noticeDocId = nextDocumentId();
  const noticeDoc: DocumentDetail = {
    id: noticeDocId,
    // 'notice' is a mock-only extension — see the DocumentKind comment (GAP-02).
    kind: 'notice',
    number: 'Уведомление об отпуске',
    requestId: id,
    status: 'to_sign',
    issuedAt: now,
    signers: [{ employeeId: me.id, fullName: me.fullName, role: 'employee', signedAt: null, method: null }],
    pdfUrl: `https://example.org/demo/${noticeDocId}.pdf`,
    sha256: 'demo-hash',
    integrityVerified: true,
    history: [],
  };
  DOCUMENTS[applicationDocId] = applicationDoc;
  DOCUMENTS[noticeDocId] = noticeDoc;

  const detail: LeaveRequestDetail = {
    id,
    employee,
    startDate: body.startDate,
    endDate: body.endDate,
    calendarDays: verdict.calendarDays,
    chargeableDays: verdict.chargeableDays,
    status: 'pending',
    verdictLevel: verdict.level,
    notifyDeadline: verdict.notifyBy,
    payDeadline: verdict.payBy,
    comment: body.comment ?? null,
    createdAt: new Date().toISOString(),
    documents: [applicationDoc, noticeDoc],
    verdict,
    rejectReason: null,
    replacesId: null,
    history: [
      {
        occurredAt: new Date().toISOString(),
        action: 'submit',
        fromStatus: null,
        toStatus: 'pending',
        actorId: me.id,
        actorName: me.fullName,
        method: null,
      },
    ],
  };
  LEAVE_REQUESTS[id] = detail;
  return delay(detail);
}

// ---- GET /leave-requests/{id} --------------------------------------------
export async function getLeaveRequest(id: string): Promise<LeaveRequestDetail> {
  requireLinked();
  const request = LEAVE_REQUESTS[id];
  if (!request) throw notFound('Заявка не найдена');

  const me = currentMe();
  const isOwner = request.employee.id === me.id;
  const isManagerAtLocation = me.roles.includes('manager') && request.employee.locationId === me.locationId;
  const canView = isOwner || isManagerAtLocation || me.roles.includes('accountant') || me.roles.includes('admin');
  if (!canView) throw forbidden('Эта заявка вам недоступна');

  return delay(request);
}

// ---- POST /leave-requests/{id}/approve -----------------------------------
export async function approveLeaveRequest(id: string, body: ApproveLeaveRequest): Promise<LeaveRequestDetail> {
  requireLinked();
  const me = currentMe();
  if (!me.roles.includes('manager')) throw forbidden('Согласование доступно только руководителю');

  const request = LEAVE_REQUESTS[id];
  if (!request) throw notFound('Заявка не найдена');

  if (request.status === 'approved') return delay(request);
  if (request.status === 'rejected' || request.status === 'cancelled') {
    throw conflict('Заявка уже в статусе, несовместимом с согласованием');
  }

  request.status = 'approved';
  request.history.push({
    occurredAt: new Date().toISOString(),
    action: 'approve',
    fromStatus: 'pending',
    toStatus: 'approved',
    actorId: me.id,
    actorName: me.fullName,
    method: body.method,
  });

  const docId = nextDocumentId();
  const doc: DocumentDetail = {
    id: docId,
    kind: 'order_t6',
    number: `Приказ Т-6 № ${docId.replace('doc-', '')}/2026`,
    requestId: id,
    status: 'to_sign',
    issuedAt: new Date().toISOString(),
    // Approving is a decision, not a signature — the manager still has to
    // formally sign the generated order via the Signing screen (Figma's
    // PostApproval "Перейти к подписанию" button), so no signer is
    // pre-filled here. See signDocument() (GAP-01) for the actual signature.
    signers: [],
    pdfUrl: `https://example.org/demo/${docId}.pdf`,
    sha256: 'demo-hash',
    integrityVerified: true,
    history: [],
  };
  DOCUMENTS[docId] = doc;
  request.documents = [...request.documents, doc];

  AUDIT_LOG.unshift({
    occurredAt: new Date().toISOString(),
    actorId: me.id,
    actorName: me.fullName,
    entity: 'leave_request',
    entityId: id,
    action: 'approve',
    fromStatus: 'pending',
    toStatus: 'approved',
    method: body.method,
    hash: `h${AUDIT_LOG.length + 1}`,
    prevHash: AUDIT_LOG[0]?.hash ?? null,
  });

  return delay(request);
}

// ---- POST /leave-requests/{id}/reject -------------------------------------
export async function rejectLeaveRequest(id: string, body: RejectLeaveRequest): Promise<LeaveRequestDetail> {
  requireLinked();
  const me = currentMe();
  if (!me.roles.includes('manager')) throw forbidden('Отклонение доступно только руководителю');

  const request = LEAVE_REQUESTS[id];
  if (!request) throw notFound('Заявка не найдена');
  if (request.status !== 'pending') {
    throw alreadyResolved(`Уже обработана (${request.status})`);
  }
  if (body.reasonCode === 'other' && !body.reasonText) {
    throw validationError('Укажите причину отказа', [{ field: 'reasonText', issue: 'обязательно при reasonCode=other' }]);
  }

  request.status = 'rejected';
  request.rejectReason = body.reasonText ?? REASON_LABEL[body.reasonCode];
  request.history.push({
    occurredAt: new Date().toISOString(),
    action: 'reject',
    fromStatus: 'pending',
    toStatus: 'rejected',
    actorId: me.id,
    actorName: me.fullName,
    method: null,
  });
  return delay(request);
}

const REASON_LABEL: Record<RejectLeaveRequest['reasonCode'], string> = {
  team_overlap: 'Пересекается с отпуском коллеги',
  high_load: 'Высокая загрузка',
  other: 'Другое',
};

// ---- POST /leave-requests/{id}/cancel --------------------------------------
export async function cancelLeaveRequest(id: string): Promise<LeaveRequestDetail> {
  requireLinked();
  const me = currentMe();
  const request = LEAVE_REQUESTS[id];
  if (!request) throw notFound('Заявка не найдена');
  if (request.employee.id !== me.id) throw forbidden('Отозвать можно только свою заявку');
  if (request.status !== 'pending') throw conflict('Заявка не в статусе pending — отзыв недоступен');

  request.status = 'cancelled';
  request.history.push({
    occurredAt: new Date().toISOString(),
    action: 'cancel',
    fromStatus: 'pending',
    toStatus: 'cancelled',
    actorId: me.id,
    actorName: me.fullName,
    method: null,
  });
  return delay(request);
}

// ---- GET /team/calendar ------------------------------------------------
export async function getTeamCalendar(from: string, to: string): Promise<TeamCalendarEntry[]> {
  requireLinked();
  return delay(TEAM_CALENDAR.filter((e) => e.startDate <= to && e.endDate >= from));
}

// ---- GET /rules ----------------------------------------------------------
export async function listRules(): Promise<Rule[]> {
  return delay(RULES);
}

// ---- GET /documents/{id} --------------------------------------------------
export async function getDocument(id: string): Promise<DocumentDetail> {
  requireLinked();
  const doc = DOCUMENTS[id];
  if (!doc) throw notFound('Документ не найден');
  return delay(doc);
}

/** Mock-only (see SHIFT_LEAVE_REQUEST): who's on leave, for the Substitution header. */
export async function getShiftContext(shiftId: string): Promise<{ employeeName: string; startDate: string; endDate: string } | null> {
  requireLinked();
  const requestId = SHIFT_LEAVE_REQUEST[shiftId];
  const request = requestId ? LEAVE_REQUESTS[requestId] : undefined;
  if (!request) return null;
  return delay({
    employeeName: request.employee.fullName,
    startDate: request.startDate,
    endDate: request.endDate,
  });
}

// ---- GET /shifts/{id}/candidates ------------------------------------------
export async function listShiftCandidates(shiftId: string): Promise<ShiftCandidate[]> {
  requireLinked();
  const me = currentMe();
  if (!me.roles.includes('manager')) throw forbidden('Подбор подмены доступен только руководителю');
  return delay(SHIFT_CANDIDATES[shiftId] ?? []);
}

// ---- POST /shift-offers -----------------------------------------------------
export async function createShiftOffer(body: CreateShiftOfferRequest): Promise<ShiftOffer> {
  requireLinked();
  const me = currentMe();
  if (!me.roles.includes('manager')) throw forbidden('Предложение смены доступно только руководителю');

  const candidate = Object.values(SHIFT_CANDIDATES)
    .flat()
    .find((c) => c.employeeId === body.employeeId);

  const id = `offer-${Object.keys(SHIFT_OFFERS).length + 1}`;
  const offer: ShiftOffer = {
    id,
    shiftId: body.shiftId,
    employeeId: body.employeeId,
    score: candidate?.score ?? 0.5,
    reasons: candidate?.reasons ?? [],
    status: 'proposed',
    createdAt: new Date().toISOString(),
  };
  SHIFT_OFFERS[id] = offer;
  return delay(offer);
}

/** Recommendation in the contract (section 1, Employee table): the "Предложение смены" screen
 * is reached via deeplink `off_<id>` and needs to fetch its own data from somewhere. */
export async function getShiftOffer(id: string): Promise<ShiftOffer & { shiftLabel: string; payBonus: string }> {
  requireLinked();
  const offer = SHIFT_OFFERS[id];
  if (!offer) throw notFound('Предложение не найдено');
  return delay({ ...offer, shiftLabel: `Замена в ${LOCATION_NAME}`, payBonus: '1 800 ₽' });
}

// ---- POST /shift-offers/{id}/accept -----------------------------------------
export async function acceptShiftOffer(id: string): Promise<ShiftOffer> {
  requireLinked();
  const offer = SHIFT_OFFERS[id];
  if (!offer) throw notFound('Предложение не найдено');
  if (offer.status === 'accepted') return delay(offer);
  if (offer.status !== 'proposed') throw alreadyResolved('Предложение уже обработано');
  offer.status = 'accepted';
  return delay(offer);
}

/** GAP-05 (not in the official contract): symmetric decline, used by the "Не смогу" button. */
export async function declineShiftOffer(id: string): Promise<ShiftOffer> {
  requireLinked();
  const offer = SHIFT_OFFERS[id];
  if (!offer) throw notFound('Предложение не найдено');
  if (offer.status !== 'proposed') throw alreadyResolved('Предложение уже обработано');
  offer.status = 'declined';
  return delay(offer);
}

// ---- PUT /me/availability -----------------------------------------------------
export async function setMyAvailability(windows: AvailabilityWindow[]): Promise<AvailabilityWindow[]> {
  requireLinked();
  const me = currentMe();
  AVAILABILITY[me.id] = windows;
  return delay(windows);
}

/** Recommendation in the contract (section 1): architectural MD only documents PUT. */
export async function getMyAvailability(): Promise<AvailabilityWindow[]> {
  requireLinked();
  const me = currentMe();
  return delay(AVAILABILITY[me.id] ?? []);
}

// ---- GET /audit -----------------------------------------------------------------
export async function listAudit(params: { requestId?: string; employeeId?: string; from?: string; to?: string }): Promise<AuditEntry[]> {
  requireLinked();
  const me = currentMe();
  if (!me.roles.includes('manager') && !me.roles.includes('accountant') && !me.roles.includes('admin')) {
    throw forbidden('Журнал доступен руководителю, бухгалтеру и администратору');
  }
  let entries = AUDIT_LOG;
  if (params.requestId) entries = entries.filter((e) => e.entityId === params.requestId);
  if (params.employeeId) entries = entries.filter((e) => e.actorId === params.employeeId);
  if (params.from) entries = entries.filter((e) => e.occurredAt.slice(0, 10) >= params.from!);
  if (params.to) entries = entries.filter((e) => e.occurredAt.slice(0, 10) <= params.to!);
  return delay(entries);
}

// ---- GET /audit/export -----------------------------------------------------------
export async function exportAuditPackage(_from: string, _to: string): Promise<{ url: string; filename: string }> {
  requireLinked();
  return delay({ url: 'https://example.org/demo/audit-package.zip', filename: 'audit-package.zip' });
}

// =====================================================================================
// GAP stubs (see "СМЕНА — API-контракт" §7). Figma requires these screens but the
// architectural MD documents no endpoint for them — kept separate and clearly marked
// so it's obvious they're not part of the 16 contracted paths.
// =====================================================================================

/** GAP-03: no company-wide document list endpoint exists yet. */
export async function listAllDocuments(): Promise<DocumentDetail[]> {
  requireLinked();
  return delay(Object.values(DOCUMENTS));
}

export interface DocumentWithOwner extends DocumentDetail {
  ownerName: string;
}

/** Same GAP-03 stub, enriched with the owning employee's name — Figma's
 * Document Registry row reads "Приказ Т-6 № 14/2026 · Кузнецов А. П.", which
 * needs a join across leave_requests that a real registry endpoint would
 * do server-side. */
export async function listAllDocumentsWithOwner(): Promise<DocumentWithOwner[]> {
  requireLinked();
  return delay(
    Object.values(DOCUMENTS).map((doc) => ({
      ...doc,
      ownerName: LEAVE_REQUESTS[doc.requestId]?.employee.fullName ?? 'Неизвестный сотрудник',
    })),
  );
}

/** GAP-04: no aggregated "upcoming payouts" endpoint exists yet. */
export async function listPaymentDeadlines(): Promise<LeaveRequestSummary[]> {
  requireLinked();
  return delay(Object.values(LEAVE_REQUESTS).filter((r) => r.status === 'approved' || r.status === 'pending').map(toSummary));
}

/** GAP-04: no "mark as paid" action exists yet. */
export async function markPaid(_requestId: string): Promise<void> {
  requireLinked();
  await delay(undefined);
}

/** GAP-01: no endpoint confirms a signature and flips documents.status → signed. */
export async function signDocument(id: string, method: 'biometric' | 'confirm'): Promise<DocumentDetail> {
  requireLinked();
  const me = currentMe();
  const doc = DOCUMENTS[id];
  if (!doc) throw notFound('Документ не найден');
  doc.signers = [
    ...doc.signers,
    { employeeId: me.id, fullName: me.fullName, role: me.roles[0], signedAt: new Date().toISOString(), method },
  ];
  doc.status = 'signed';
  return delay(doc, 600);
}

/** GAP-06: whole Admin surface (company/employees/settings) is undocumented. */
export async function listEmployees(): Promise<Employee[]> {
  requireLinked();
  return delay(Object.values(EMPLOYEES));
}

export async function getCompanySummary() {
  requireLinked();
  return delay({
    name: 'ООО «Ромашка»',
    locations: 1,
    managersInvited: 1,
    employeesConnected: 12,
    employeesInvited: 18,
    locationName: LOCATION_NAME,
  });
}

export const DEMO_TODAY_ISO = DEMO_TODAY;
