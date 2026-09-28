import type {
  AuditEntry,
  AvailabilityWindow,
  DocumentDetail,
  Employee,
  LeaveRequestDetail,
  Me,
  Role,
  Rule,
  Shift,
  ShiftCandidate,
  ShiftOffer,
  TeamCalendarEntry,
} from './types';
import { computeVerdict } from './rulesEngine';

export const LOCATION_ID = 'loc-baumana-12';
export const LOCATION_NAME = '«Баумана, 12»';

export const EMPLOYEES: Record<string, Employee> = {
  'emp-marina': {
    id: 'emp-marina',
    fullName: 'Петрова Марина Алексеевна',
    position: 'Кассир-консультант',
    locationId: LOCATION_ID,
    locationName: LOCATION_NAME,
  },
  'emp-kuznetsov': {
    id: 'emp-kuznetsov',
    fullName: 'Кузнецов Артём Павлович',
    position: 'Продавец-кассир',
    locationId: LOCATION_ID,
    locationName: LOCATION_NAME,
  },
  'emp-sidorov': {
    id: 'emp-sidorov',
    fullName: 'Сидоров Игорь Николаевич',
    position: 'Продавец-кассир',
    // Same internal locationId as everyone else (Смирнова manages the whole
    // network per README §3 "управляющий сетью"), but a different physical
    // point — confirmed by Figma's Inbox screen showing him at «Ленина, 4»
    // while Марина/Кузнецов are at «Баумана, 12».
    locationId: LOCATION_ID,
    locationName: '«Ленина, 4»',
  },
  'emp-smirnova': {
    id: 'emp-smirnova',
    fullName: 'Смирнова Елена Викторовна',
    position: 'Управляющая точкой',
    locationId: LOCATION_ID,
    locationName: LOCATION_NAME,
  },
  'emp-ivanova': {
    id: 'emp-ivanova',
    fullName: 'Иванова Ольга Сергеевна',
    position: 'Бухгалтер',
    locationId: LOCATION_ID,
    locationName: LOCATION_NAME,
  },
  'emp-volkov': {
    id: 'emp-volkov',
    fullName: 'Волков Дмитрий Александрович',
    position: 'Владелец компании',
    locationId: LOCATION_ID,
    locationName: LOCATION_NAME,
  },
  'emp-alexey': {
    id: 'emp-alexey',
    fullName: 'Алексей К.',
    position: 'Продавец-кассир',
    locationId: LOCATION_ID,
    locationName: LOCATION_NAME,
  },
};

/**
 * Display-only remaining-balance figures for OTHER employees, shown in
 * Manager-facing rows (Inbox, Approval, Team). Figma's `Employee Row`
 * literally renders "остаток N дней" there — but `components.schemas.Employee`
 * in the API contract deliberately omits balance ("без чужого остатка...
 * эти данные никто, кроме самого сотрудника, не видит"). That's a real
 * conflict between the assembled screens and the contract's own stated
 * privacy principle; kept here as mock-only presentation data (never part
 * of the `Employee` wire type) so the manager screens render as designed
 * without pretending the field exists on the real DTO.
 */
export const EMPLOYEE_BALANCE_DAYS: Record<string, number> = {
  'emp-marina': 28,
  'emp-kuznetsov': 20,
  'emp-sidorov': 14,
};

/**
 * Demo "current user" per role — this repo has no real MAX auth wired up
 * (GET /me resolves the caller from `X-Max-Init-Data`, which only exists
 * inside the real MAX client). The dev-only role switcher in AuthContext
 * picks one of these instead, so every screen/role is reachable in a
 * plain browser without a MAX host.
 */
export const ME_BY_ROLE: Record<Role, Me> = {
  employee: {
    id: 'emp-marina',
    fullName: 'Петрова Марина Алексеевна',
    position: 'Кассир-консультант',
    locationId: LOCATION_ID,
    locationName: LOCATION_NAME,
    roles: ['employee'],
    leaveBalance: { days: 28, asOf: '2026-09-25' },
    isDemo: true,
  },
  manager: {
    id: 'emp-smirnova',
    fullName: 'Смирнова Елена Викторовна',
    position: 'Управляющая точкой',
    locationId: LOCATION_ID,
    locationName: LOCATION_NAME,
    roles: ['manager'],
    leaveBalance: { days: 24, asOf: '2026-09-25' },
    isDemo: true,
  },
  accountant: {
    id: 'emp-ivanova',
    fullName: 'Иванова Ольга Сергеевна',
    position: 'Бухгалтер',
    locationId: LOCATION_ID,
    locationName: LOCATION_NAME,
    roles: ['accountant'],
    leaveBalance: { days: 28, asOf: '2026-09-25' },
    isDemo: true,
  },
  admin: {
    id: 'emp-volkov',
    fullName: 'Волков Дмитрий Александрович',
    position: 'Владелец компании',
    locationId: LOCATION_ID,
    locationName: LOCATION_NAME,
    roles: ['admin'],
    leaveBalance: { days: 28, asOf: '2026-09-25' },
    isDemo: true,
  },
};

export const TEAM_CALENDAR: TeamCalendarEntry[] = [
  { employeeId: 'emp-kuznetsov', fullName: 'Кузнецов Артём Павлович', startDate: '2026-10-05', endDate: '2026-10-18' },
  { employeeId: 'emp-sidorov', fullName: 'Сидоров Игорь Николаевич', startDate: '2026-11-01', endDate: '2026-11-07' },
];

let requestSeq = 4;
export const nextRequestId = () => `req-${requestSeq++}`;

let documentSeq = 4;
export const nextDocumentId = () => `doc-${documentSeq++}`;

export const DOCUMENTS: Record<string, DocumentDetail> = {
  'doc-1': {
    id: 'doc-1',
    kind: 'application',
    number: 'Заявление № 14/2026',
    requestId: 'req-1',
    // Submitting the leave request itself IS the employee's act of signing
    // the application (ПЭП at submit time) — no separate outstanding
    // signature, matching Figma's Home screen which never surfaces this
    // document under "Нужно подписать".
    status: 'formed',
    issuedAt: '2026-09-18T10:00:00Z',
    signers: [],
    pdfUrl: 'https://example.org/demo/application-14-2026.pdf',
    sha256: 'a1b2c3d4e5f6',
    integrityVerified: true,
    history: [
      { occurredAt: '2026-09-18T10:00:00Z', action: 'form', fromStatus: null, toStatus: 'pending', actorId: 'system', actorName: 'Система', method: null },
    ],
  },
  'doc-3': {
    id: 'doc-3',
    kind: 'notice',
    number: 'Уведомление об отпуске',
    requestId: 'req-1',
    status: 'to_sign',
    issuedAt: '2026-09-18T10:02:00Z',
    signers: [{ employeeId: 'emp-marina', fullName: 'Петрова М. А.', role: 'employee', signedAt: null, method: null }],
    pdfUrl: 'https://example.org/demo/notice-14-2026.pdf',
    sha256: 'aa11bb22cc33',
    integrityVerified: true,
    history: [
      { occurredAt: '2026-09-18T10:02:00Z', action: 'form', fromStatus: null, toStatus: 'pending', actorId: 'system', actorName: 'Система', method: null },
    ],
  },
  'doc-2': {
    id: 'doc-2',
    kind: 'order_t6',
    number: 'Приказ Т-6 № 14/2026',
    requestId: 'req-1',
    status: 'to_sign',
    issuedAt: '2026-09-18T10:05:00Z',
    signers: [{ employeeId: 'emp-smirnova', fullName: 'Смирнова Е. В.', role: 'manager', signedAt: '2026-09-18T14:32:00Z', method: 'biometric' }],
    pdfUrl: 'https://example.org/demo/order-t6-14-2026.pdf',
    sha256: 'f6e5d4c3b2a1',
    integrityVerified: true,
    history: [
      { occurredAt: '2026-09-18T10:05:00Z', action: 'form', fromStatus: null, toStatus: 'pending', actorId: 'system', actorName: 'Система', method: null },
      { occurredAt: '2026-09-18T14:32:00Z', action: 'sign', fromStatus: null, toStatus: 'approved', actorId: 'emp-smirnova', actorName: 'Смирнова Е. В.', method: 'biometric' },
    ],
  },
};

interface SeedRequestInput {
  id: string;
  employeeId: string;
  startDate: string;
  endDate: string;
  leaveBalanceDays: number;
  createdAt: string;
  actorName: string;
  documents?: DocumentDetail[];
}

/**
 * Builds a seed LeaveRequestDetail whose summary fields (verdictLevel,
 * notifyDeadline, payDeadline) are derived from the SAME computeVerdict()
 * call as the nested `verdict` object — keeping them hardcoded separately
 * previously let the two drift out of sync (e.g. a green banner next to a
 * checklist that actually flagged a team-overlap warning).
 */
function seedRequest({
  id,
  employeeId,
  startDate,
  endDate,
  leaveBalanceDays,
  createdAt,
  actorName,
  documents = [],
}: SeedRequestInput): LeaveRequestDetail {
  const verdict = computeVerdict({
    startDate,
    endDate,
    leaveBalanceDays,
    employeeId,
    teamCalendar: TEAM_CALENDAR,
  });
  return {
    id,
    employee: EMPLOYEES[employeeId],
    startDate,
    endDate,
    calendarDays: verdict.calendarDays,
    chargeableDays: verdict.chargeableDays,
    status: 'pending',
    verdictLevel: verdict.level,
    notifyDeadline: verdict.notifyBy,
    payDeadline: verdict.payBy,
    comment: null,
    createdAt,
    documents,
    verdict,
    rejectReason: null,
    replacesId: null,
    history: [
      { occurredAt: createdAt, action: 'submit', fromStatus: null, toStatus: 'pending', actorId: employeeId, actorName, method: null },
    ],
  };
}

export const LEAVE_REQUESTS: Record<string, LeaveRequestDetail> = {
  'req-1': seedRequest({
    id: 'req-1',
    employeeId: 'emp-marina',
    startDate: '2026-10-05',
    endDate: '2026-10-18',
    leaveBalanceDays: 28,
    createdAt: '2026-09-18T09:00:00Z',
    actorName: 'Петрова М. А.',
    documents: [DOCUMENTS['doc-1'], DOCUMENTS['doc-3'], DOCUMENTS['doc-2']],
  }),
  'req-2': seedRequest({
    id: 'req-2',
    employeeId: 'emp-kuznetsov',
    startDate: '2026-10-05',
    endDate: '2026-10-18',
    leaveBalanceDays: 30,
    createdAt: '2026-09-18T08:00:00Z',
    actorName: 'Кузнецов А. П.',
  }),
  'req-3': seedRequest({
    id: 'req-3',
    employeeId: 'emp-sidorov',
    startDate: '2026-11-01',
    endDate: '2026-11-07',
    leaveBalanceDays: 12,
    createdAt: '2026-09-19T08:00:00Z',
    actorName: 'Сидоров И. Н.',
  }),
};

export const RULES: Rule[] = [
  {
    id: 'tk.115.balance',
    type: 'calculation',
    check: 'leave_balance',
    severity: 'block',
    params: { accrualPerMonth: 2.33 },
    norm: { title: 'ст. 115, 124 ТК РФ', url: 'https://example.org/tk/115' },
    effectiveFrom: '2026-01-01',
    checkedAt: '2026-09-20',
    messages: { pass: 'Остаток дней', fail: 'Недостаточно остатка дней отпуска' },
  },
  {
    id: 'tk.123.notice',
    type: 'law',
    check: 'notice_period',
    severity: 'block',
    params: { minDaysBeforeStart: 14 },
    norm: { title: 'ст. 123 ТК РФ', url: 'https://example.org/tk/123' },
    effectiveFrom: '2026-01-01',
    checkedAt: '2026-09-20',
    messages: { pass: 'Срок извещения соблюдён', fail: 'Известить нужно не позднее чем за 2 недели' },
  },
  {
    id: 'tk.125.min-part-14',
    type: 'law',
    check: 'min_part_length',
    severity: 'warn',
    params: { minCalendarDays: 14 },
    norm: { title: 'ст. 125 ТК РФ', url: 'https://example.org/tk/125' },
    effectiveFrom: '2026-01-01',
    checkedAt: '2026-09-20',
    messages: { pass: 'Часть отпуска не менее 14 дней', fail: 'Часть отпуска короче 14 дней' },
  },
  {
    id: 'tk.120.holidays',
    type: 'calculation',
    check: 'holiday_recalculation',
    severity: 'warn',
    norm: { title: 'ст. 120 ТК РФ', url: 'https://example.org/tk/120' },
    effectiveFrom: '2026-01-01',
    checkedAt: '2026-09-20',
    messages: { pass: 'Праздники не входят в число дней отпуска', fail: 'Пересчёт из-за праздничных дней' },
  },
  {
    id: 'tk.124.two-years',
    type: 'law',
    check: 'no_skip_two_years',
    severity: 'block',
    norm: { title: 'ст. 124 ТК РФ', url: 'https://example.org/tk/124' },
    effectiveFrom: '2026-01-01',
    checkedAt: '2026-09-20',
    messages: { pass: 'Отпуск предоставляется ежегодно', fail: 'Нельзя не предоставлять отпуск два года подряд' },
  },
];

export const SHIFTS: Record<string, Shift> = {
  'shift-1': {
    id: 'shift-1',
    locationId: LOCATION_ID,
    locationName: LOCATION_NAME,
    startsAt: '2026-10-05T09:00:00Z',
    endsAt: '2026-10-05T21:00:00Z',
    roleRequired: 'Продавец-кассир',
    skillsRequired: ['kkt'],
    status: 'open',
  },
};

/**
 * Mock-only: which approved leave request opened up each shift. The
 * contract's `Shift` schema has no such link (a real backend would derive
 * open shifts from the schedule once a request is approved) — needed so the
 * Substitution screen's header can show "На время отпуска Кузнецова А. П. ·
 * 5–18 октября" like Figma, instead of a generic placeholder.
 */
export const SHIFT_LEAVE_REQUEST: Record<string, string> = {
  'shift-1': 'req-2',
};

export const SHIFT_CANDIDATES: Record<string, ShiftCandidate[]> = {
  'shift-1': [
    {
      employeeId: 'emp-alexey',
      fullName: 'Алексей К.',
      position: 'Продавец-кассир',
      score: 0.92,
      reasons: ['Свободен пн, вт, чт', '1,2 км от точки', '12 подтверждённых смен, ни одной неявки'],
    },
    {
      employeeId: 'emp-sidorov',
      fullName: 'Сидоров Игорь Николаевич',
      position: 'Продавец-кассир',
      score: 0.71,
      reasons: ['Свободен сегодня 9:00–21:00', '3,4 км от точки', '5 подтверждённых смен, 1 неявка'],
    },
  ],
};

export const SHIFT_OFFERS: Record<string, ShiftOffer> = {
  'offer-1': {
    id: 'offer-1',
    shiftId: 'shift-1',
    employeeId: 'emp-alexey',
    score: 0.92,
    reasons: ['Свободен пн, вт, чт', '1,2 км от точки', '12 подтверждённых смен, ни одной неявки'],
    status: 'proposed',
    createdAt: '2026-09-20T08:00:00Z',
  },
};

export const AVAILABILITY: Record<string, AvailabilityWindow[]> = {
  'emp-marina': [
    { weekday: 'mon', timeFrom: '09:00', timeTo: '21:00', openForExtra: true },
    { weekday: 'tue', timeFrom: '09:00', timeTo: '21:00', openForExtra: false },
    { weekday: 'thu', timeFrom: '09:00', timeTo: '21:00', openForExtra: true },
  ],
};

export const AUDIT_LOG: AuditEntry[] = [
  {
    occurredAt: '2026-09-18T09:00:00Z',
    actorId: 'emp-marina',
    actorName: 'Петрова М. А.',
    entity: 'leave_request',
    entityId: 'req-1',
    action: 'submit',
    fromStatus: null,
    toStatus: 'pending',
    method: null,
    hash: 'h1',
    prevHash: null,
  },
  {
    occurredAt: '2026-09-18T14:32:00Z',
    actorId: 'emp-smirnova',
    actorName: 'Смирнова Е. В.',
    entity: 'document',
    entityId: 'doc-2',
    action: 'sign',
    fromStatus: 'pending',
    toStatus: 'approved',
    method: 'biometric',
    hash: 'h2',
    prevHash: 'h1',
  },
];
