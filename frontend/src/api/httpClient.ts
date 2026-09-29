/**
 * Real backend implementation of the 16 contracted endpoints (+ the
 * recommended `GET /me/availability` read, see api/routers/availability.py)
 * from "СМЕНА — API-контракт и OpenAPI". Same function names/signatures as
 * mockApi.ts by design — api/client.ts picks between the two per function,
 * so no page needs to change its import.
 *
 * GAP-01..06 functions (signing, document registry, payment deadlines,
 * shift decline, admin) have no real endpoint yet — client.ts routes those
 * to mockApi.ts regardless of mode.
 */
import { getPersona } from '../context/authStore';
import { LOCATION_NAME, ME_BY_ROLE } from './fixtures';
import { ApiError, notLinked, validationError } from './errors';
import { maxBridge } from '../bridge/maxBridge';
import type {
  ApproveLeaveRequest,
  ApproveScheduleT7Request,
  AuditEntry,
  AvailabilityWindow,
  CompanySummary,
  CreateCompanyRequest,
  CreatedEmployee,
  CreateEmployeeRequest,
  CreateLocationRequest,
  CreateShiftOfferRequest,
  DocumentDetail,
  DocumentRegistryEntry,
  Employee,
  ErrorResponseBody,
  LeaveRequestDetail,
  LeaveRequestSummary,
  LocationSummary,
  Me,
  PreviewRequest,
  RejectLeaveRequest,
  Rule,
  ScheduleT7Entry,
  Shift,
  ShiftCandidate,
  ShiftOffer,
  SubmitLeaveRequest,
  SubmitScheduleT7Entry,
  TeamCalendarEntry,
  UpdateEmployeeRequest,
  Verdict,
} from './types';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api';

function debugEmployeeId(): string {
  return ME_BY_ROLE[getPersona().role].id;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!getPersona().isLinked) throw notLinked();

  const headers = new Headers(init.headers);
  headers.set('X-Debug-Employee-Id', debugEmployeeId());
  headers.set('X-Max-Init-Data', maxBridge.initData);
  if (init.body) headers.set('Content-Type', 'application/json');

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...init, headers });
  } catch {
    throw validationError('Не удалось связаться с сервером. Проверьте соединение.');
  }

  if (response.status === 204) return undefined as T;

  const isJson = response.headers.get('content-type')?.includes('application/json');
  const body = isJson ? await response.json() : undefined;

  if (!response.ok) {
    const err = (body as ErrorResponseBody | undefined)?.error;
    throw new ApiError(err?.code ?? 'VALIDATION_ERROR', err?.message ?? 'Ошибка сервера', response.status, err?.details ?? []);
  }

  return body as T;
}

/**
 * Для двух bootstrap-эндпоинтов (POST /companies, POST /employees/link) —
 * вызывающий на этом шаге ещё НЕ привязан ни к какому сотруднику, поэтому
 * request() выше не подходит (кидает notLinked() раньше, чем дойдёт до
 * fetch). Ни один из них не проверяется через get_current_employee на
 * бэкенде, так что debug/init-data заголовки им не нужны.
 */
async function requestUnauthenticated<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set('Content-Type', 'application/json');

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...init, headers });
  } catch {
    throw validationError('Не удалось связаться с сервером. Проверьте соединение.');
  }

  const isJson = response.headers.get('content-type')?.includes('application/json');
  const body = isJson ? await response.json() : undefined;

  if (!response.ok) {
    const err = (body as ErrorResponseBody | undefined)?.error;
    throw new ApiError(err?.code ?? 'VALIDATION_ERROR', err?.message ?? 'Ошибка сервера', response.status, err?.details ?? []);
  }
  return body as T;
}

const json = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body) });

// ---- GET /me ----------------------------------------------------------
// №17: asOf — необязательный параметр «остаток на произвольную дату».
export const getMe = (asOf?: string) => request<Me>(`/me${asOf ? `?asOf=${asOf}` : ''}`);

// ---- POST /companies (bootstrap, без привязанного сотрудника) ------------
export const createCompany = (payload: Omit<CreateCompanyRequest, 'maxUserId'>) =>
  requestUnauthenticated<Me>(
    '/companies',
    json({ ...payload, maxUserId: maxBridge.maxUserId ?? '' } satisfies CreateCompanyRequest),
  );

// ---- POST /locations -------------------------------------------------------
export const createLocation = (payload: CreateLocationRequest) =>
  request<LocationSummary>('/locations', json(payload));

// ---- GET /companies/me/summary --------------------------------------------
export const getCompanySummary = () => request<CompanySummary>('/companies/me/summary');

// ---- POST /employees/link (bootstrap, без привязанного сотрудника) -------
export const linkEmployee = (inviteCode: string) =>
  requestUnauthenticated<Me>(
    '/employees/link',
    json({ inviteCode, maxUserId: maxBridge.maxUserId ?? '' }),
  );

// ---- POST /employees --------------------------------------------------------
export const createEmployee = (payload: CreateEmployeeRequest) =>
  request<CreatedEmployee>('/employees', json(payload));

// ---- GET /employees ---------------------------------------------------------
export const listEmployees = () => request<Employee[]>('/employees');

// ---- PATCH /employees/{id} ---------------------------------------------------
export const updateEmployee = (id: string, payload: UpdateEmployeeRequest) =>
  request<Employee>(`/employees/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });

// ---- POST /leave-requests/preview -------------------------------------
export const previewLeaveRequest = (body: PreviewRequest) =>
  request<Verdict>('/leave-requests/preview', json(body));

// ---- GET /leave-requests?scope= ----------------------------------------
export const listLeaveRequests = (scope: 'mine' | 'inbox' | 'deadlines') =>
  request<LeaveRequestSummary[]>(`/leave-requests?scope=${scope}`);

// ---- POST /leave-requests ------------------------------------------------
export const submitLeaveRequest = (body: SubmitLeaveRequest) =>
  request<LeaveRequestDetail>('/leave-requests', json(body));

// ---- GET /leave-requests/{id} --------------------------------------------
export const getLeaveRequest = (id: string) => request<LeaveRequestDetail>(`/leave-requests/${id}`);

// ---- POST /leave-requests/{id}/approve -----------------------------------
export const approveLeaveRequest = (id: string, body: ApproveLeaveRequest) =>
  request<LeaveRequestDetail>(`/leave-requests/${id}/approve`, json(body));

// ---- POST /leave-requests/{id}/reject -------------------------------------
export const rejectLeaveRequest = (id: string, body: RejectLeaveRequest) =>
  request<LeaveRequestDetail>(`/leave-requests/${id}/reject`, json(body));

// ---- POST /leave-requests/{id}/cancel --------------------------------------
export const cancelLeaveRequest = (id: string) =>
  request<LeaveRequestDetail>(`/leave-requests/${id}/cancel`, { method: 'POST' });

// ---- GET /team/calendar ------------------------------------------------
export const getTeamCalendar = (from: string, to: string) =>
  request<TeamCalendarEntry[]>(`/team/calendar?from=${from}&to=${to}`);

// ---- GET /rules ----------------------------------------------------------
export const listRules = () => request<Rule[]>('/rules');

// ---- GET /documents/{id} --------------------------------------------------
export const getDocument = (id: string) => request<DocumentDetail>(`/documents/${id}`);

// ---- GET /documents (GAP-03: реестр документов компании) -------------------
export const listAllDocuments = () => request<DocumentRegistryEntry[]>('/documents');
export const listAllDocumentsWithOwner = listAllDocuments;

// ---- POST /documents/{id}/sign (GAP-01) ------------------------------------
export const signDocument = (id: string, method: 'biometric' | 'confirm') =>
  request<DocumentDetail>(`/documents/${id}/sign`, json({ method }));

// ---- GET /leave-requests?scope=deadlines (GAP-04) --------------------------
export const listPaymentDeadlines = () => listLeaveRequests('deadlines');

// ---- POST /leave-requests/{id}/mark-paid (GAP-04) --------------------------
export const markPaid = (id: string) =>
  request<LeaveRequestDetail>(`/leave-requests/${id}/mark-paid`, { method: 'POST' });

// ---- GET /shifts?status= ----------------------------------------------------
export const listShifts = (status?: string) => request<Shift[]>(`/shifts${status ? `?status=${status}` : ''}`);

/** Substitution.tsx header — не отдельный эндпоинт, а композиция из уже
 * существующих: находим смену в списке смен точки, дальше берём имя и даты
 * из заявки на отпуск, которая её открыла (Shift.sourceRequestId). */
export async function getShiftContext(
  shiftId: string,
): Promise<{ employeeName: string; startDate: string; endDate: string } | null> {
  const shifts = await listShifts();
  const shift = shifts.find((s) => s.id === shiftId);
  if (!shift?.sourceRequestId) return null;
  const request_ = await getLeaveRequest(shift.sourceRequestId);
  return { employeeName: request_.employee.fullName, startDate: request_.startDate, endDate: request_.endDate };
}

// ---- POST /schedule-t7/entries ----------------------------------------------
export const submitScheduleT7Entry = (payload: SubmitScheduleT7Entry) =>
  request<ScheduleT7Entry>('/schedule-t7/entries', json(payload));

// ---- GET /schedule-t7?year= --------------------------------------------------
export const listScheduleT7 = (year: number) => request<ScheduleT7Entry[]>(`/schedule-t7?year=${year}`);

// ---- POST /schedule-t7/approve -----------------------------------------------
export const approveScheduleT7 = (payload: ApproveScheduleT7Request) =>
  request<ScheduleT7Entry[]>('/schedule-t7/approve', json(payload));

// ---- GET /shifts/{id}/candidates ------------------------------------------
export const listShiftCandidates = (shiftId: string) =>
  request<ShiftCandidate[]>(`/shifts/${shiftId}/candidates`);

// ---- POST /shift-offers -----------------------------------------------------
export const createShiftOffer = (body: CreateShiftOfferRequest) =>
  request<ShiftOffer>('/shift-offers', json(body));

// ---- POST /shift-offers/{id}/accept -----------------------------------------
export const acceptShiftOffer = (id: string) =>
  request<ShiftOffer>(`/shift-offers/${id}/accept`, { method: 'POST' });

// ---- POST /shift-offers/{id}/decline (GAP-05) -------------------------------
export const declineShiftOffer = (id: string) =>
  request<ShiftOffer>(`/shift-offers/${id}/decline`, { method: 'POST' });

// ---- GET /shift-offers/{id} (Рекомендация — см. routers/shifts.py get_shift_offer) --
// `payBonus` не приходит с бэкенда (README §9 Won't Have №32 — зарплатных
// данных нет вообще) — это чисто витринная подпись, как и в mockApi.
export async function getShiftOffer(id: string): Promise<ShiftOffer & { shiftLabel: string; payBonus: string }> {
  const offer = await request<ShiftOffer>(`/shift-offers/${id}`);
  return { ...offer, shiftLabel: `Замена в ${LOCATION_NAME}`, payBonus: '1 800 ₽' };
}

// ---- PUT /me/availability -----------------------------------------------------
export const setMyAvailability = (windows: AvailabilityWindow[]) =>
  request<AvailabilityWindow[]>('/me/availability', { method: 'PUT', body: JSON.stringify(windows) });

// ---- GET /me/availability (Рекомендация, не GAP — см. routers/availability.py) --
export const getMyAvailability = () => request<AvailabilityWindow[]>('/me/availability');

// ---- GET /audit -----------------------------------------------------------------
export const listAudit = (params: { requestId?: string; employeeId?: string; from?: string; to?: string }) => {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]);
  const suffix = qs.toString() ? `?${qs}` : '';
  return request<AuditEntry[]>(`/audit${suffix}`);
};

// ---- GET /audit/export -----------------------------------------------------------
// Бэкенд отдаёт не сам ZIP, а подписанную ссылку на него (api/app/routers/audit.py) —
// тот же приём, что и для PDF документов: реальному WebApp.downloadFile() в MAX
// нужен обычный https-URL, а не blob:-ссылка, живущая только в памяти этого веб-вью.
export const exportAuditPackage = (from: string, to: string) =>
  request<{ url: string; filename: string }>(`/audit/export?from=${from}&to=${to}`);
