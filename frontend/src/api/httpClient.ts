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
  AuditEntry,
  AvailabilityWindow,
  CreateShiftOfferRequest,
  DocumentDetail,
  ErrorResponseBody,
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

const json = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body) });

// ---- GET /me ----------------------------------------------------------
export const getMe = () => request<Me>('/me');

// ---- POST /leave-requests/preview -------------------------------------
export const previewLeaveRequest = (body: PreviewRequest) =>
  request<Verdict>('/leave-requests/preview', json(body));

// ---- GET /leave-requests?scope= ----------------------------------------
export const listLeaveRequests = (scope: 'mine' | 'inbox') =>
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

// ---- GET /shifts/{id}/candidates ------------------------------------------
export const listShiftCandidates = (shiftId: string) =>
  request<ShiftCandidate[]>(`/shifts/${shiftId}/candidates`);

// ---- POST /shift-offers -----------------------------------------------------
export const createShiftOffer = (body: CreateShiftOfferRequest) =>
  request<ShiftOffer>('/shift-offers', json(body));

// ---- POST /shift-offers/{id}/accept -----------------------------------------
export const acceptShiftOffer = (id: string) =>
  request<ShiftOffer>(`/shift-offers/${id}/accept`, { method: 'POST' });

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
export async function exportAuditPackage(from: string, to: string): Promise<{ url: string; filename: string }> {
  if (!getPersona().isLinked) throw notLinked();
  const headers = new Headers({
    'X-Debug-Employee-Id': debugEmployeeId(),
    'X-Max-Init-Data': maxBridge.initData,
  });
  const response = await fetch(`${API_BASE}/audit/export?from=${from}&to=${to}`, { headers });
  if (!response.ok) {
    const body = (await response.json().catch(() => undefined)) as ErrorResponseBody | undefined;
    const err = body?.error;
    throw new ApiError(
      err?.code ?? 'VALIDATION_ERROR',
      err?.message ?? 'Не удалось собрать папку к проверке',
      response.status,
      err?.details ?? [],
    );
  }
  const blob = await response.blob();
  return { url: URL.createObjectURL(blob), filename: `audit-${from}-${to}.zip` };
}
