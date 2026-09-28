import { useState } from 'react';
import type { VerdictLevel } from '../api/types';
import styles from './CalendarRange.module.css';

const WEEKDAYS = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];
const MONTH_NAMES = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
];

function toISO(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

/** Monday-first weekday index (0 = Monday). */
function mondayIndex(year: number, month: number, day: number) {
  const jsDay = new Date(year, month, day).getDay();
  return (jsDay + 6) % 7;
}

interface BusyEntry {
  employeeName: string;
}

interface CalendarRangeProps {
  startDate: string | null;
  endDate: string | null;
  verdictLevel?: VerdictLevel;
  holidays?: Set<string>;
  busyDates?: Record<string, BusyEntry[]>;
  onSelect: (range: { startDate: string; endDate: string | null }) => void;
  initialMonth?: { year: number; month: number };
}

export function CalendarRange({
  startDate,
  endDate,
  verdictLevel,
  holidays,
  busyDates,
  onSelect,
  initialMonth,
}: CalendarRangeProps) {
  const today = new Date();
  const [cursor, setCursor] = useState(
    initialMonth ?? { year: today.getFullYear(), month: today.getMonth() },
  );
  const [tappedBusy, setTappedBusy] = useState<string | null>(null);

  const total = daysInMonth(cursor.year, cursor.month);
  const leadingBlanks = mondayIndex(cursor.year, cursor.month, 1);

  const rangeClass = verdictLevel === 'red' ? styles.rangeBad : verdictLevel === 'yellow' ? styles.rangeWarn : styles.rangeOk;

  function isInRange(iso: string) {
    if (!startDate) return false;
    if (!endDate) return iso === startDate;
    return iso >= startDate && iso <= endDate;
  }

  function handleDayClick(iso: string) {
    if (!startDate || (startDate && endDate)) {
      onSelect({ startDate: iso, endDate: null });
      return;
    }
    if (iso < startDate) {
      onSelect({ startDate: iso, endDate: startDate });
    } else {
      onSelect({ startDate, endDate: iso });
    }
  }

  const cells: (number | null)[] = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: total }, (_, i) => i + 1),
  ];
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  function shiftMonth(delta: number) {
    setCursor(({ year, month }) => {
      const next = month + delta;
      if (next < 0) return { year: year - 1, month: 11 };
      if (next > 11) return { year: year + 1, month: 0 };
      return { year, month: next };
    });
  }

  return (
    <div className={styles.calendar}>
      <div className={styles.monthRow}>
        <button type="button" className={styles.monthNav} onClick={() => shiftMonth(-1)} aria-label="Предыдущий месяц">
          ‹
        </button>
        <p className={styles.month}>
          {MONTH_NAMES[cursor.month]} {cursor.year}
        </p>
        <button type="button" className={styles.monthNav} onClick={() => shiftMonth(1)} aria-label="Следующий месяц">
          ›
        </button>
      </div>
      <div className={styles.weekdays}>
        {WEEKDAYS.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>
      {weeks.map((week, wi) => (
        <div className={styles.week} key={wi}>
          {week.map((day, di) => {
            if (day === null) return <div key={di} className={styles.cell} />;
            const iso = toISO(cursor.year, cursor.month, day);
            const holiday = holidays?.has(iso);
            const busy = busyDates?.[iso];
            const inRange = isInRange(iso);
            const isEdge = iso === startDate || iso === endDate;
            return (
              <div key={di} className={styles.cell}>
                <button
                  type="button"
                  className={[
                    styles.day,
                    inRange ? rangeClass : '',
                    isEdge ? styles.edge : '',
                    holiday ? styles.holiday : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => handleDayClick(iso)}
                >
                  {day}
                </button>
                {!!busy?.length && (
                  <button
                    type="button"
                    className={styles.busyDot}
                    aria-label={`Заняты: ${busy.map((b) => b.employeeName).join(', ')}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setTappedBusy(tappedBusy === iso ? null : iso);
                    }}
                  />
                )}
                {tappedBusy === iso && busy?.length && (
                  <div className={styles.busyTooltip}>{busy.map((b) => b.employeeName).join(', ')}</div>
                )}
              </div>
            );
          })}
        </div>
      ))}
      <p className={styles.legend}>· — занято коллегами (имя по тапу) · праздник — не списывается</p>
    </div>
  );
}
