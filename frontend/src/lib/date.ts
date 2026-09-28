const MONTHS_GENITIVE = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
];

export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function toISO(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const d = parseISO(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return toISO(d);
}

export function diffDays(fromIso: string, toIso: string): number {
  const a = parseISO(fromIso).getTime();
  const b = parseISO(toIso).getTime();
  return Math.round((b - a) / 86_400_000);
}

export function formatRu(iso: string): string {
  const d = parseISO(iso);
  return `${d.getUTCDate()} ${MONTHS_GENITIVE[d.getUTCMonth()]}`;
}

export function formatRange(startIso: string, endIso: string): string {
  const start = parseISO(startIso);
  const end = parseISO(endIso);
  if (start.getUTCMonth() === end.getUTCMonth() && start.getUTCFullYear() === end.getUTCFullYear()) {
    return `${start.getUTCDate()}–${end.getUTCDate()} ${MONTHS_GENITIVE[end.getUTCMonth()]}`;
  }
  return `${formatRu(startIso)} – ${formatRu(endIso)}`;
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const hours = String(d.getUTCHours()).padStart(2, '0');
  const minutes = String(d.getUTCMinutes()).padStart(2, '0');
  return `${day}.${month}.${d.getUTCFullYear()} ${hours}:${minutes}`;
}

/** "18 сентября 2026" from an ISO datetime (e.g. a document's issuedAt). */
export function formatRuDateTimeLong(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCDate()} ${MONTHS_GENITIVE[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function isoDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}
