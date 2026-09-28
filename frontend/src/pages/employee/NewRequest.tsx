import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../../components/Header';
import { Button } from '../../components/Button';
import { CalendarRange } from '../../components/CalendarRange';
import { VerdictBanner } from '../../components/VerdictBanner';
import { CheckRow } from '../../components/CheckRow';
import { BottomSheet, SheetTitle, SheetText } from '../../components/BottomSheet';
import { getTeamCalendar, previewLeaveRequest, submitLeaveRequest } from '../../api/mockApi';
import { ApiError } from '../../api/errors';
import { formatRu } from '../../lib/date';
import { getRuleExplanation } from '../../lib/ruleExplanations';
import type { CheckResult, TeamCalendarEntry, Verdict } from '../../api/types';
import styles from './NewRequest.module.css';

export default function NewRequest() {
  const navigate = useNavigate();
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [recalculated, setRecalculated] = useState(false);
  const [openRule, setOpenRule] = useState<CheckResult | null>(null);
  const [busyDates, setBusyDates] = useState<Record<string, { employeeName: string }[]>>({});
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    getTeamCalendar('2026-09-01', '2026-12-31').then((entries: TeamCalendarEntry[]) => {
      const map: Record<string, { employeeName: string }[]> = {};
      entries.forEach((e) => {
        let cursor = e.startDate;
        while (cursor <= e.endDate) {
          map[cursor] = [...(map[cursor] ?? []), { employeeName: e.fullName }];
          cursor = addDaysLocal(cursor, 1);
        }
      });
      setBusyDates(map);
    });
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!startDate || !endDate) {
      setVerdict(null);
      return;
    }
    setPreviewLoading(true);
    debounceRef.current = setTimeout(() => {
      previewLeaveRequest({ startDate, endDate })
        .then(setVerdict)
        .finally(() => setPreviewLoading(false));
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [startDate, endDate]);

  async function handleSubmit(dates?: { startDate: string; endDate: string }) {
    const finalStart = dates?.startDate ?? startDate;
    const finalEnd = dates?.endDate ?? endDate;
    if (!finalStart || !finalEnd) return;
    setSubmitting(true);
    setSubmitError(null);
    setRecalculated(false);
    try {
      const detail = await submitLeaveRequest({
        startDate: finalStart,
        endDate: finalEnd,
        comment: comment || null,
      });
      navigate(`/employee/requests/${detail.id}`, { replace: true });
    } catch (e) {
      if (e instanceof ApiError && e.code === 'RULE_VIOLATION') {
        setRecalculated(true);
      } else if (e instanceof ApiError) {
        setSubmitError(e.message);
      } else {
        setSubmitError('Не удалось отправить заявку');
      }
    } finally {
      setSubmitting(false);
    }
  }

  // Page 07 — States, "7. Recalculated Verdict": submit's RULE_VIOLATION
  // means the server re-checked and got a different (worse) answer than the
  // preview shown — re-run the preview so the banner reflects reality.
  function handleRecheck() {
    setRecalculated(false);
    if (!startDate || !endDate) return;
    setPreviewLoading(true);
    previewLeaveRequest({ startDate, endDate })
      .then(setVerdict)
      .finally(() => setPreviewLoading(false));
  }

  const hasUnsavedChanges = !!startDate || comment.trim().length > 0;

  function handleBack() {
    if (hasUnsavedChanges) {
      setLeaveConfirmOpen(true);
      return;
    }
    navigate(-1);
  }

  return (
    <div className="screen">
      <Header title="Новая заявка" onBack={handleBack} />
      <CalendarRange
        startDate={startDate}
        endDate={endDate}
        verdictLevel={verdict?.level}
        busyDates={busyDates}
        onSelect={({ startDate: s, endDate: e }) => {
          setStartDate(s);
          setEndDate(e);
        }}
      />
      <div className="screen-content">
        {!verdict && !previewLoading && (
          <p className={styles.hint}>Выберите даты отпуска в календаре выше</p>
        )}

        {previewLoading && <p className={styles.hint}>Считаем вердикт…</p>}

        {verdict && !previewLoading && startDate && endDate && (
          <>
            <p className={styles.summary}>
              {verdict.calendarDays} календарных дней · спишется {verdict.chargeableDays} · останется{' '}
              {verdict.balanceAfter}
            </p>
            <VerdictBanner
              level={verdict.level}
              detail={
                verdict.level === 'red'
                  ? `До начала ${diffLabel(startDate)} дней, а известить нужно за 14`
                  : `${formatRu(startDate)}–${formatRu(endDate)}, ${verdict.calendarDays} дней`
              }
            />
            <div>
              {verdict.checks.map((check) => (
                <CheckRow key={check.ruleId} check={check} onOpenRule={setOpenRule} />
              ))}
            </div>
            <div className={styles.deadlines}>
              <p>⏰ Известить до {formatRu(verdict.notifyBy)}</p>
              <p>⏰ Выплатить отпускные до {formatRu(verdict.payBy)}</p>
            </div>
            <textarea
              className={styles.comment}
              placeholder="Комментарий руководителю (необязательно, до 200 символов)"
              maxLength={200}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />

            {submitError && <p className={styles.error}>{submitError}</p>}

            {recalculated && (
              <div className={styles.recalculated}>
                <p className={styles.recalculatedText}>
                  Вердикт изменился с момента проверки — условия могли поменяться. Проверьте условия ещё раз.
                </p>
                <Button variant="text" onClick={handleRecheck}>
                  Проверить ещё раз
                </Button>
              </div>
            )}

            {verdict.level === 'red' ? (
              <>
                <Button
                  variant="text"
                  onClick={() => {
                    setStartDate(null);
                    setEndDate(null);
                    setVerdict(null);
                  }}
                >
                  Выбрать другие даты
                </Button>
                {verdict.suggestion && (
                  <Button loading={submitting} onClick={() => handleSubmit(verdict.suggestion!)}>
                    Подать на {formatRu(verdict.suggestion.startDate)}
                  </Button>
                )}
              </>
            ) : (
              <Button loading={submitting} onClick={() => handleSubmit()}>
                Отправить на согласование
              </Button>
            )}
          </>
        )}
      </div>

      <BottomSheet open={!!openRule} onClose={() => setOpenRule(null)}>
        {openRule && (
          <>
            <SheetTitle>{openRule.norm?.title ?? 'Правило компании'}</SheetTitle>
            <SheetText>{getRuleExplanation(openRule)}</SheetText>
            <Button onClick={() => setOpenRule(null)}>Понятно</Button>
          </>
        )}
      </BottomSheet>

      <BottomSheet open={leaveConfirmOpen} onClose={() => setLeaveConfirmOpen(false)}>
        <SheetTitle>Уйти без сохранения?</SheetTitle>
        <SheetText>Введённый комментарий и выбранные даты не будут сохранены</SheetText>
        <Button variant="text" onClick={() => setLeaveConfirmOpen(false)}>
          Остаться
        </Button>
        <Button onClick={() => navigate(-1)}>Уйти без сохранения</Button>
      </BottomSheet>
    </div>
  );
}

function diffLabel(startDate: string) {
  const ms = new Date(startDate).getTime() - new Date('2026-09-16').getTime();
  return Math.round(ms / 86_400_000);
}

function addDaysLocal(iso: string, days: number) {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
