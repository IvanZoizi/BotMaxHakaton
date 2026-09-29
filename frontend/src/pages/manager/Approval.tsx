import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Header } from '../../components/Header';
import { Button } from '../../components/Button';
import { EmployeeRow } from '../../components/EmployeeRow';
import { VerdictBanner } from '../../components/VerdictBanner';
import { CheckRow } from '../../components/CheckRow';
import { BottomSheet, SheetTitle, SheetText } from '../../components/BottomSheet';
import { SkeletonScreen, ErrorState, ForbiddenState } from '../../components/States';
import { approveLeaveRequest, getLeaveRequest, getTeamCalendar, rejectLeaveRequest } from '../../api/client';
import { ApiError } from '../../api/errors';
import { useAsync } from '../../lib/useAsync';
import { formatRu, formatRange, addDays, formatDateTime } from '../../lib/date';
import { findAlternativeWindows } from '../../lib/alternativeDates';
import { getRuleExplanation } from '../../lib/ruleExplanations';
import { maxBridge } from '../../bridge/maxBridge';
import type { CheckResult, LeaveRequestDetail, RejectReasonCode } from '../../api/types';
import styles from './Approval.module.css';

const RESOLVED_VERB: Record<string, string> = {
  approved: 'согласована',
  rejected: 'отклонена',
  cancelled: 'отозвана',
};

// Page 07 — States, "6. Already Resolved": "Эта заявка уже обработана
// другим руководителем (согласована {дата}, {время}). Обновите список."
function alreadyResolvedText(request: LeaveRequestDetail): string {
  const resolvingEvent = request.history[request.history.length - 1];
  const verb = RESOLVED_VERB[request.status] ?? 'обработана';
  if (!resolvingEvent) return `Эта заявка уже обработана (${verb}). Обновите список.`;
  return `Эта заявка уже обработана — ${resolvingEvent.actorName} (${verb} ${formatDateTime(resolvingEvent.occurredAt)}). Обновите список.`;
}

export default function Approval() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data: request, loading, error, reload } = useAsync(() => getLeaveRequest(id), [id]);
  const { data: teamCalendar } = useAsync(
    () => (request ? getTeamCalendar(request.startDate, addDays(request.startDate, 180)) : Promise.resolve([])),
    [request?.startDate],
  );

  const [approving, setApproving] = useState(false);
  const [approved, setApproved] = useState(false);
  const [newDocumentId, setNewDocumentId] = useState<string | null>(null);
  const [confirmFallback, setConfirmFallback] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reasonCode, setReasonCode] = useState<RejectReasonCode | null>(null);
  const [reasonText, setReasonText] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [openRule, setOpenRule] = useState<CheckResult | null>(null);

  if (loading) {
    return (
      <div className="screen">
        <Header title="Заявка на отпуск" />
        <SkeletonScreen />
      </div>
    );
  }

  if (error?.code === 'FORBIDDEN') {
    return (
      <div className="screen">
        <Header title="Заявка на отпуск" />
        <ForbiddenState message="Эта заявка вам недоступна" />
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="screen">
        <Header title="Заявка на отпуск" />
        <ErrorState onRetry={reload} />
      </div>
    );
  }

  async function doApprove(method: 'biometric' | 'confirm') {
    setApproving(true);
    setInlineError(null);
    try {
      const updated = await approveLeaveRequest(id, { method });
      setNewDocumentId(updated.documents[updated.documents.length - 1]?.id ?? null);
      setApproved(true);
    } catch (e) {
      setInlineError(e instanceof ApiError ? e.message : 'Не удалось согласовать заявку');
    } finally {
      setApproving(false);
    }
  }

  async function handleApproveClick() {
    const result = await maxBridge.biometric.authenticate();
    if (result.status === 'authorized') {
      await doApprove('biometric');
    } else {
      setConfirmFallback(true);
    }
  }

  async function handleReject() {
    if (!reasonCode || !request) return;
    if (reasonCode === 'other' && !reasonText.trim()) return;
    setRejecting(true);
    setInlineError(null);
    try {
      const [firstAlternative] = findAlternativeWindows(
        request.calendarDays,
        (teamCalendar ?? []).filter((e) => e.employeeId !== request.employee.id),
        addDays(request.startDate, 1),
        1,
      );
      await rejectLeaveRequest(id, {
        reasonCode,
        reasonText: reasonText || null,
        alternativeStart: firstAlternative?.startDate ?? null,
        alternativeEnd: firstAlternative?.endDate ?? null,
      });
      setRejectOpen(false);
      reload();
    } catch (e) {
      setInlineError(e instanceof ApiError ? e.message : 'Не удалось отклонить заявку');
    } finally {
      setRejecting(false);
    }
  }

  if (approved) {
    return (
      <div className="screen">
        <Header title="Заявка на отпуск" />
        <div className="screen-content">
          <div className={styles.successBox}>
            <p className={styles.successIcon}>✓</p>
            <p className={styles.successTitle}>Заявка согласована</p>
            <p className={styles.successSubtitle}>
              {request.employee.fullName} · {formatRange(request.startDate, request.endDate)}
            </p>
          </div>
          <div className={styles.steps}>
            <p className={styles.stepRow}>
              <span className={styles.stepIconDone}>✓</span>
              <span className={styles.stepTextDone}>Согласовано</span>
            </p>
            <p className={styles.stepRow}>
              <span className={styles.stepIconPending}>○</span>
              <span className={styles.stepTextPending}>Ожидает подписания (руководитель, затем сотрудник)</span>
            </p>
            <p className={styles.stepRow}>
              <span className={styles.stepIconPending}>○</span>
              <span className={styles.stepTextPending}>Документ отправлен в архив</span>
            </p>
          </div>
          <Button
            onClick={() =>
              navigate(newDocumentId ? `/manager/documents/${newDocumentId}/sign` : '/manager/inbox')
            }
          >
            Перейти к подписанию
          </Button>
        </div>
      </div>
    );
  }

  const alreadyDone = request.status !== 'pending';

  return (
    <div className="screen">
      <Header title="Заявка на отпуск" />
      <div className="screen-content">
        <EmployeeRow fullName={request.employee.fullName} subtitle={request.employee.position} avatarSize={56} />
        <p className={styles.summary}>
          {formatRange(request.startDate, request.endDate)} · {request.verdict.calendarDays} календарных
          дней · спишется {request.verdict.chargeableDays} · останется {request.verdict.balanceAfter}
        </p>
        <VerdictBanner
          level={request.verdictLevel}
          detail={`${formatRange(request.startDate, request.endDate)}, ${request.verdict.calendarDays} дней`}
        />
        <div>
          {request.verdict.checks.map((check) => (
            <CheckRow key={check.ruleId} check={check} onOpenRule={setOpenRule} />
          ))}
        </div>
        <div className={styles.deadlines}>
          <p>⏰ Известить сотрудника до {formatRu(request.notifyDeadline)}</p>
          <p>⏰ Выплатить отпускные до {formatRu(request.payDeadline)}</p>
        </div>

        {inlineError && <p className={styles.error}>{inlineError}</p>}

        {alreadyDone ? (
          <div className={styles.alreadyResolved}>
            <p className={styles.alreadyResolvedText}>{alreadyResolvedText(request)}</p>
            <Button variant="text" onClick={reload}>
              Обновить
            </Button>
          </div>
        ) : (
          <>
            <Button variant="text" tone="danger" onClick={() => setRejectOpen(true)}>
              Отклонить
            </Button>
            <Button loading={approving} onClick={handleApproveClick}>
              Согласовать
            </Button>
          </>
        )}
      </div>

      <BottomSheet open={confirmFallback} onClose={() => setConfirmFallback(false)}>
        <SheetTitle>Подтвердите подпись</SheetTitle>
        <SheetText>
          Способ подписи будет записан как «подтверждение в приложении» вместо биометрии.
        </SheetText>
        <Button
          loading={approving}
          onClick={async () => {
            await doApprove('confirm');
            setConfirmFallback(false);
          }}
        >
          Подтверждаю
        </Button>
      </BottomSheet>

      <BottomSheet open={rejectOpen} onClose={() => setRejectOpen(false)}>
        <SheetTitle>Причина отказа</SheetTitle>
        <div className={styles.reasonList}>
          {(
            [
              ['team_overlap', 'Пересекается с отпуском коллеги'],
              ['high_load', 'Высокая загрузка'],
              ['other', 'Другое'],
            ] as [RejectReasonCode, string][]
          ).map(([code, label]) => (
            <button
              key={code}
              type="button"
              className={`${styles.reasonOption} ${reasonCode === code ? styles.reasonOptionSelected : ''}`}
              onClick={() => setReasonCode(code)}
            >
              {label}
            </button>
          ))}
        </div>
        {reasonCode === 'other' && (
          <textarea
            className={styles.reasonText}
            placeholder="Опишите причину"
            value={reasonText}
            onChange={(e) => setReasonText(e.target.value)}
          />
        )}
        <p className={styles.altDates}>
          Альтернативные даты:{' '}
          {findAlternativeWindows(
            request.calendarDays,
            (teamCalendar ?? []).filter((e) => e.employeeId !== request.employee.id),
            addDays(request.startDate, 1),
          )
            .map((w) => formatRu(w.startDate))
            .join(' · ') || 'свободных окон в ближайшие полгода не нашлось'}
        </p>
        <Button
          disabled={!reasonCode || (reasonCode === 'other' && !reasonText.trim())}
          loading={rejecting}
          onClick={handleReject}
        >
          Отклонить и предложить даты
        </Button>
      </BottomSheet>

      <BottomSheet open={!!openRule} onClose={() => setOpenRule(null)}>
        {openRule && (
          <>
            <SheetTitle>{openRule.norm?.title ?? 'Правило компании'}</SheetTitle>
            <SheetText>{getRuleExplanation(openRule)}</SheetText>
            <Button onClick={() => setOpenRule(null)}>Понятно</Button>
          </>
        )}
      </BottomSheet>
    </div>
  );
}
