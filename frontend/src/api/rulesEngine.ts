import type { CheckResult, TeamCalendarEntry, Verdict, VerdictLevel } from './types';
import { addDays, diffDays, formatRu } from '../lib/date';

/**
 * "Today" fixed for the demo dataset so every canned scenario in the
 * product README (green/yellow/red) reproduces exactly, regardless of the
 * real wall-clock date. This mirrors `isDemo` — the whole balance/leave
 * dataset is seeded, not live.
 */
export const DEMO_TODAY = '2026-09-16';
export const RULES_VERSION = '3f9a1c2b';

const HOLIDAYS = new Set([
  '2026-01-01',
  '2026-01-02',
  '2026-01-03',
  '2026-01-04',
  '2026-01-05',
  '2026-01-06',
  '2026-01-07',
  '2026-01-08',
  '2026-02-23',
  '2026-03-08',
  '2026-05-01',
  '2026-05-09',
  '2026-06-12',
  '2026-11-04',
  '2027-01-01',
  '2027-01-02',
  '2027-01-03',
  '2027-01-04',
  '2027-01-05',
  '2027-01-06',
  '2027-01-07',
  '2027-01-08',
]);

function holidaysInRange(startDate: string, endDate: string): string[] {
  const out: string[] = [];
  let cursor = startDate;
  while (cursor <= endDate) {
    if (HOLIDAYS.has(cursor)) out.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return out;
}

interface ComputeVerdictInput {
  startDate: string;
  endDate: string;
  leaveBalanceDays: number;
  employeeId: string;
  teamCalendar: TeamCalendarEntry[];
  today?: string;
}

export function computeVerdict({
  startDate,
  endDate,
  leaveBalanceDays,
  employeeId,
  teamCalendar,
  today = DEMO_TODAY,
}: ComputeVerdictInput): Verdict {
  const calendarDays = diffDays(startDate, endDate) + 1;
  const holidays = holidaysInRange(startDate, endDate);
  const chargeableDays = Math.max(calendarDays - holidays.length, 0);
  const balanceAfter = Math.round((leaveBalanceDays - chargeableDays) * 100) / 100;
  const noticeDays = diffDays(today, startDate);
  const notifyBy = addDays(startDate, -14);
  const payBy = addDays(startDate, -3);

  const checks: CheckResult[] = [];
  let hasBlock = false;
  let hasWarn = false;

  const balancePassed = balanceAfter >= 0;
  if (!balancePassed) hasBlock = true;
  checks.push({
    ruleId: 'tk.115.balance',
    type: 'calculation',
    passed: balancePassed,
    severity: balancePassed ? 'info' : 'block',
    message: balancePassed
      ? 'Остаток дней'
      : `Недостаточно остатка: доступно ${leaveBalanceDays}, требуется ${chargeableDays}`,
    norm: { title: 'ст. 115 ТК РФ', url: 'https://example.org/tk/115' },
    checkedAt: '2026-09-20',
  });

  const noticePassed = noticeDays >= 14;
  if (!noticePassed) hasBlock = true;
  checks.push({
    ruleId: 'tk.123.notice',
    type: 'law',
    passed: noticePassed,
    severity: noticePassed ? 'info' : 'block',
    message: noticePassed
      ? `Срок извещения соблюдён — уведомление до ${formatRu(notifyBy)}`
      : `До начала отпуска ${noticeDays} дн., а известить нужно за 14`,
    norm: { title: 'ст. 123 ТК РФ', url: 'https://example.org/tk/123' },
    checkedAt: '2026-09-20',
  });

  const minPartPassed = calendarDays >= 14;
  if (!minPartPassed) hasWarn = true;
  checks.push({
    ruleId: 'tk.125.min-part-14',
    type: 'law',
    passed: minPartPassed,
    severity: minPartPassed ? 'info' : 'warn',
    message: minPartPassed
      ? 'Требование о части отпуска не менее 14 дней выполнено'
      : 'Часть отпуска короче 14 календарных дней',
    norm: { title: 'ст. 125 ТК РФ', url: 'https://example.org/tk/125' },
    checkedAt: '2026-09-20',
  });

  if (holidays.length > 0) {
    hasWarn = true;
    checks.push({
      ruleId: 'tk.120.holidays',
      type: 'calculation',
      passed: true,
      severity: 'warn',
      message: `В период попадают нерабочие праздничные дни — спишется ${chargeableDays} дней вместо ${calendarDays}`,
      norm: { title: 'ст. 120 ТК РФ', url: 'https://example.org/tk/120' },
      checkedAt: '2026-09-20',
    });
  }

  const overlap = teamCalendar.find(
    (entry) =>
      entry.employeeId !== employeeId && entry.startDate <= endDate && entry.endDate >= startDate,
  );
  if (overlap) {
    hasWarn = true;
    checks.push({
      ruleId: 'company.team-overlap',
      type: 'company',
      passed: false,
      severity: 'warn',
      message: `Пересекается с отпуском коллеги ${overlap.fullName}`,
      norm: null,
      checkedAt: '2026-09-20',
    });
  } else {
    checks.push({
      ruleId: 'company.team-overlap',
      type: 'company',
      passed: true,
      severity: 'info',
      message: 'Конфликтов по смене нет',
      norm: null,
      checkedAt: '2026-09-20',
    });
  }

  const level: VerdictLevel = hasBlock ? 'red' : hasWarn ? 'yellow' : 'green';

  let suggestion: Verdict['suggestion'] = null;
  if (level === 'red') {
    const suggestedStart = addDays(today, 14);
    const suggestedEnd = addDays(suggestedStart, calendarDays - 1);
    suggestion = { startDate: suggestedStart, endDate: suggestedEnd };
  }

  return {
    level,
    calendarDays,
    chargeableDays,
    balanceAfter,
    notifyBy,
    payBy,
    checks,
    suggestion,
    rulesVersion: RULES_VERSION,
  };
}
