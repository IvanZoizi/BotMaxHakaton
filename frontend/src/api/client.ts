/**
 * Single entry point every page/component imports from (replaces direct
 * mockApi.ts imports). The contracted endpoints plus GAP-01..06 (now real,
 * see api/app/routers/*) go to the real backend by default; set
 * VITE_API_MODE=mock to fall back to the in-memory mock for offline UI work.
 *
 * Brand-new features built in this pass (company bootstrap, employee CRUD,
 * Т-7 schedule collection) have no mock fixtures — building a parallel
 * offline dataset for them is out of proportion to what the mock mode is
 * for (previewing existing screens without a backend), so these always hit
 * the real backend regardless of VITE_API_MODE.
 */
import * as http from './httpClient';
import * as mock from './mockApi';

const USE_MOCK = import.meta.env.VITE_API_MODE === 'mock';

// ---- contracted endpoints ------------------------------------------------
export const getMe = USE_MOCK ? mock.getMe : http.getMe;
export const previewLeaveRequest = USE_MOCK ? mock.previewLeaveRequest : http.previewLeaveRequest;
export const listLeaveRequests = USE_MOCK ? mock.listLeaveRequests : http.listLeaveRequests;
export const submitLeaveRequest = USE_MOCK ? mock.submitLeaveRequest : http.submitLeaveRequest;
export const getLeaveRequest = USE_MOCK ? mock.getLeaveRequest : http.getLeaveRequest;
export const approveLeaveRequest = USE_MOCK ? mock.approveLeaveRequest : http.approveLeaveRequest;
export const rejectLeaveRequest = USE_MOCK ? mock.rejectLeaveRequest : http.rejectLeaveRequest;
export const cancelLeaveRequest = USE_MOCK ? mock.cancelLeaveRequest : http.cancelLeaveRequest;
export const getTeamCalendar = USE_MOCK ? mock.getTeamCalendar : http.getTeamCalendar;
export const listRules = USE_MOCK ? mock.listRules : http.listRules;
export const getDocument = USE_MOCK ? mock.getDocument : http.getDocument;
export const listShiftCandidates = USE_MOCK ? mock.listShiftCandidates : http.listShiftCandidates;
export const createShiftOffer = USE_MOCK ? mock.createShiftOffer : http.createShiftOffer;
export const acceptShiftOffer = USE_MOCK ? mock.acceptShiftOffer : http.acceptShiftOffer;
export const setMyAvailability = USE_MOCK ? mock.setMyAvailability : http.setMyAvailability;
export const listAudit = USE_MOCK ? mock.listAudit : http.listAudit;
export const exportAuditPackage = USE_MOCK ? mock.exportAuditPackage : http.exportAuditPackage;

// ---- Рекомендация (not in the 16 paths, but not a GAP either — see contract §1) --
export const getMyAvailability = USE_MOCK ? mock.getMyAvailability : http.getMyAvailability;
export const getShiftOffer = USE_MOCK ? mock.getShiftOffer : http.getShiftOffer;
export const getShiftContext = USE_MOCK ? mock.getShiftContext : http.getShiftContext;

// ---- GAP-01, 03, 04, 05 — теперь реальные эндпоинты (api/app/routers/documents.py, leave_requests.py, shifts.py) --
export const signDocument = USE_MOCK ? mock.signDocument : http.signDocument;
export const listAllDocuments = USE_MOCK ? mock.listAllDocuments : http.listAllDocuments;
export const listAllDocumentsWithOwner = USE_MOCK ? mock.listAllDocumentsWithOwner : http.listAllDocumentsWithOwner;
export const listPaymentDeadlines = USE_MOCK ? mock.listPaymentDeadlines : http.listPaymentDeadlines;
export const markPaid = USE_MOCK ? mock.markPaid : http.markPaid;
export const declineShiftOffer = USE_MOCK ? mock.declineShiftOffer : http.declineShiftOffer;

// ---- GAP-06 — реальный CRUD сотрудников (api/app/routers/employees.py) ------
export const listEmployees = USE_MOCK ? mock.listEmployees : http.listEmployees;
export const getCompanySummary = USE_MOCK ? mock.getCompanySummary : http.getCompanySummary;
export const updateEmployee = http.updateEmployee;
export const createEmployee = http.createEmployee;

// ---- Мультитенантность (§1a плана) — всегда реальный бэкенд, мока нет -----
export const createCompany = http.createCompany;
export const createLocation = http.createLocation;
export const linkEmployee = http.linkEmployee;

// ---- Смены (№18/19) ----------------------------------------------------------
export const listShifts = http.listShifts;

// ---- График Т-7 (№24) — всегда реальный бэкенд, мока нет ---------------------
export const submitScheduleT7Entry = http.submitScheduleT7Entry;
export const listScheduleT7 = http.listScheduleT7;
export const approveScheduleT7 = http.approveScheduleT7;

export const DEMO_TODAY_ISO = mock.DEMO_TODAY_ISO;
export type { DocumentWithOwner } from './mockApi';
