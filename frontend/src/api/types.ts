/**
 * TypeScript types mirroring components.schemas in the СМЕНА openapi.yaml
 * contract (16 paths / 39 schemas). Kept 1:1 with the spec — do not add
 * fields a screen doesn't need, per the contract's own DTO principle.
 */

export type Role = 'employee' | 'manager' | 'accountant' | 'admin';

export type VerdictLevel = 'green' | 'yellow' | 'red';
export type CheckSeverity = 'block' | 'warn' | 'info';
export type CheckType = 'law' | 'calculation' | 'company';

export interface Norm {
  title: string;
  url: string;
}

export interface CheckResult {
  ruleId: string;
  type: CheckType;
  passed: boolean;
  severity: CheckSeverity;
  message: string;
  norm: Norm | null;
  checkedAt: string;
}

export interface DateRange {
  startDate: string;
  endDate: string;
}

export interface Verdict {
  level: VerdictLevel;
  calendarDays: number;
  chargeableDays: number;
  balanceAfter: number;
  notifyBy: string;
  payBy: string;
  checks: CheckResult[];
  suggestion: DateRange | null;
  rulesVersion: string;
}

export interface Employee {
  id: string;
  fullName: string;
  position: string;
  locationId: string;
  locationName?: string;
  roles?: Role[];
  category?: string | null;
  skills?: string[];
}

export interface CreateEmployeeRequest {
  fullName: string;
  position: string;
  role?: Role;
  locationId?: string;
}

export interface CreatedEmployee {
  id: string;
  fullName: string;
  position: string;
  roles: Role[];
  inviteCode: string;
}

export interface UpdateEmployeeRequest {
  fullName?: string;
  position?: string;
  roles?: Role[];
  category?: string | null;
  skills?: string[];
}

export interface LinkEmployeeRequest {
  inviteCode: string;
  maxUserId: string;
}

export interface CreateCompanyRequest {
  name: string;
  locationName: string;
  adminFullName: string;
  maxUserId: string;
}

export interface CreateLocationRequest {
  name: string;
}

export interface LocationSummary {
  id: string;
  name: string;
}

export interface CompanySummary {
  locations: number;
  managersInvited: number;
  employeesConnected: number;
  employeesInvited: number;
  locationName?: string | null;
}

export interface Me {
  id: string;
  fullName: string;
  position: string;
  locationId?: string;
  locationName?: string;
  roles: Role[];
  leaveBalance: { days: number; asOf: string };
  isDemo: boolean;
}

export type LeaveRequestStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'active'
  | 'completed';

export interface LeaveRequestSummary {
  id: string;
  employee: Employee;
  startDate: string;
  endDate: string;
  calendarDays: number;
  chargeableDays: number;
  status: LeaveRequestStatus;
  verdictLevel: VerdictLevel;
  notifyDeadline: string;
  payDeadline: string;
  comment: string | null;
  createdAt: string;
  documents: DocumentSummary[];
}

export interface HistoryEvent {
  occurredAt: string;
  action: string;
  fromStatus: LeaveRequestStatus | null;
  toStatus: LeaveRequestStatus;
  actorId: string;
  actorName: string;
  method: 'biometric' | 'confirm' | null;
}

export interface LeaveRequestDetail extends LeaveRequestSummary {
  verdict: Verdict;
  rejectReason: string | null;
  replacesId: string | null;
  history: HistoryEvent[];
}

/**
 * `'notice'` ("Уведомление об отпуске") is a mock-only extension, NOT part
 * of the official contract. GAP-02 (see "СМЕНА — API-контракт", §7) flags
 * this exact gap: `documents.kind` in the architectural MD only has 3
 * values, but Figma's Home screen ("Нужно подписать") and My Documents both
 * require a 4th/5th kind the contract never resolved. Added here so the
 * screens can render as designed; a real backend still needs to decide this.
 */
export type DocumentKind = 'application' | 'order_t6' | 'schedule_t7' | 'notice';
export type DocumentStatus =
  | 'formed'
  | 'to_sign'
  | 'signed'
  | 'in_accounting'
  | 'archived'
  | 'annulled';

export interface Signer {
  employeeId: string;
  fullName: string;
  role: string;
  signedAt: string | null;
  method: 'biometric' | 'confirm' | null;
}

export interface DocumentSummary {
  id: string;
  kind: DocumentKind;
  number: string;
  requestId: string;
  status: DocumentStatus;
  issuedAt: string;
  signers: Signer[];
}

export interface DocumentDetail extends DocumentSummary {
  pdfUrl: string;
  sha256: string;
  integrityVerified: boolean;
  history: HistoryEvent[];
}

/** GAP-03: реестр документов компании — та же карточка + владелец. */
export interface DocumentRegistryEntry extends DocumentSummary {
  ownerName: string;
}

export interface SignDocumentRequest {
  method: ApprovalMethod;
}

export interface PreviewRequest {
  startDate: string;
  endDate: string;
}

export interface SubmitLeaveRequest {
  startDate: string;
  endDate: string;
  comment?: string | null;
}

export type ApprovalMethod = 'biometric' | 'confirm';

export interface ApproveLeaveRequest {
  method: ApprovalMethod;
}

export type RejectReasonCode = 'team_overlap' | 'high_load' | 'other';

export interface RejectLeaveRequest {
  reasonCode: RejectReasonCode;
  reasonText?: string | null;
  alternativeStart?: string | null;
  alternativeEnd?: string | null;
}

export interface TeamCalendarEntry {
  employeeId: string;
  fullName: string;
  startDate: string;
  endDate: string;
}

export interface Rule {
  id: string;
  type: CheckType;
  check: string;
  severity: CheckSeverity;
  params?: Record<string, unknown>;
  norm: Norm;
  effectiveFrom: string;
  checkedAt: string;
  messages: { pass: string; fail: string };
}

export type ShiftStatus = 'open' | 'offered' | 'filled' | 'confirmed';

export interface Shift {
  id: string;
  locationId: string;
  locationName?: string;
  startsAt: string;
  endsAt: string;
  roleRequired: string;
  skillsRequired?: string[];
  status: ShiftStatus;
  sourceRequestId?: string | null;
}

export interface ShiftCandidate {
  employeeId: string;
  fullName: string;
  position: string;
  score: number;
  reasons: string[];
}

export interface CreateShiftOfferRequest {
  shiftId: string;
  employeeId: string;
}

export type ShiftOfferStatus = 'proposed' | 'accepted' | 'declined' | 'expired';

export interface ShiftOffer {
  id: string;
  shiftId: string;
  employeeId: string;
  score: number;
  reasons: string[];
  status: ShiftOfferStatus;
  createdAt: string;
}

export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export interface AvailabilityWindow {
  weekday: Weekday;
  timeFrom: string;
  timeTo: string;
  openForExtra: boolean;
}

export interface AuditEntry {
  occurredAt: string;
  actorId: string;
  actorName: string;
  entity: string;
  entityId: string;
  action: string;
  fromStatus: string | null;
  toStatus: string | null;
  method: 'biometric' | 'confirm' | null;
  hash: string;
  prevHash: string | null;
}

export type ScheduleT7EntryStatus = 'proposed' | 'approved';

export interface SubmitScheduleT7Entry {
  year: number;
  startDate: string;
  endDate: string;
}

export interface ScheduleT7Entry {
  id: string;
  employeeId: string;
  fullName: string;
  year: number;
  startDate: string;
  endDate: string;
  status: ScheduleT7EntryStatus;
  conflictsWith: string[];
}

export interface ApproveScheduleT7Request {
  year: number;
}

export type ErrorCode =
  | 'NOT_LINKED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'RULE_VIOLATION'
  | 'ALREADY_RESOLVED'
  | 'CONFLICT';

export interface ErrorDetail {
  field: string | null;
  issue: string;
}

export interface ErrorResponseBody {
  error: {
    code: ErrorCode;
    message: string;
    details: ErrorDetail[];
  };
}
