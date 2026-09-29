/**
 * Single entry point every page/component imports from (replaces direct
 * mockApi.ts imports). The 16 contracted endpoints plus the two documented
 * "Рекомендация" reads (GET /me/availability, GET /shift-offers/{id}) go to
 * the real backend by default; set VITE_API_MODE=mock to fall back to the
 * in-memory mock for offline UI work.
 *
 * GAP-01..06 functions and other mock-only helpers (getShiftContext,
 * DEMO_TODAY_ISO) have no real backend endpoint yet — see "СМЕНА —
 * API-контракт" §7 — so they always come from mockApi regardless of mode.
 */
import * as http from './httpClient';
import * as mock from './mockApi';

const USE_MOCK = import.meta.env.VITE_API_MODE === 'mock';

// ---- 16 contracted endpoints ------------------------------------------------
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

// ---- GAP-01..06 + other mock-only helpers: always mock, no real endpoint yet ----
export const getShiftContext = mock.getShiftContext;
export const declineShiftOffer = mock.declineShiftOffer;
export const listAllDocuments = mock.listAllDocuments;
export const listAllDocumentsWithOwner = mock.listAllDocumentsWithOwner;
export const listPaymentDeadlines = mock.listPaymentDeadlines;
export const markPaid = mock.markPaid;
export const signDocument = mock.signDocument;
export const listEmployees = mock.listEmployees;
export const getCompanySummary = mock.getCompanySummary;
export const DEMO_TODAY_ISO = mock.DEMO_TODAY_ISO;
export type { DocumentWithOwner } from './mockApi';
