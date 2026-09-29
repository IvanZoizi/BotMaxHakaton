/**
 * Зеркало bot/app/deeplinks.py — два разных рантайма (Python/TS), общий
 * модуль тут не сделать без монорепо-инструментов. Держать в синхроне при
 * правках на бот-стороне.
 */

export type DeepLink =
  | { kind: 'leaveRequest'; requestId: string }
  | { kind: 'shiftOffer'; offerId: string }
  | { kind: 'scheduleT7'; year: number }
  | null;

const REQUEST_ID_PREFIX = 'requestId=';
const SHIFT_OFFER_PREFIX = 'off_';
const SCHEDULE_T7_PREFIX = 't7_';

export function parseDeepLink(payload: string | null | undefined): DeepLink {
  if (!payload) return null;

  if (payload.startsWith(REQUEST_ID_PREFIX)) {
    const requestId = payload.slice(REQUEST_ID_PREFIX.length);
    return requestId ? { kind: 'leaveRequest', requestId } : null;
  }
  if (payload.startsWith(SHIFT_OFFER_PREFIX)) {
    const offerId = payload.slice(SHIFT_OFFER_PREFIX.length);
    return offerId ? { kind: 'shiftOffer', offerId } : null;
  }
  if (payload.startsWith(SCHEDULE_T7_PREFIX)) {
    const yearStr = payload.slice(SCHEDULE_T7_PREFIX.length);
    return /^\d+$/.test(yearStr) ? { kind: 'scheduleT7', year: Number(yearStr) } : null;
  }
  return null;
}
