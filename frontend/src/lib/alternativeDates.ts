import { addDays } from './date';

interface BusyRange {
  startDate: string;
  endDate: string;
}

/**
 * №6: раньше отклонение всегда предлагало [+25, -5, +8] дней от исходной
 * даты — независимо от того, свободны ли эти окна у команды. Теперь ищем
 * реально свободные окна той же длительности вперёд от исходной даты.
 */
export function findAlternativeWindows(
  durationDays: number,
  busyRanges: BusyRange[],
  searchFrom: string,
  count = 3,
  maxLookaheadDays = 180,
): { startDate: string; endDate: string }[] {
  const results: { startDate: string; endDate: string }[] = [];
  let candidateStart = searchFrom;
  for (let i = 0; i < maxLookaheadDays && results.length < count; i++) {
    const candidateEnd = addDays(candidateStart, durationDays - 1);
    const overlaps = busyRanges.some((b) => candidateStart <= b.endDate && candidateEnd >= b.startDate);
    if (!overlaps) results.push({ startDate: candidateStart, endDate: candidateEnd });
    candidateStart = addDays(candidateStart, 1);
  }
  return results;
}
