import type { DocumentStatus, LeaveRequestStatus } from '../api/types';
import styles from './StatusBadge.module.css';

const REQUEST_STATUS_LABEL: Record<LeaveRequestStatus, string> = {
  pending: 'На согласовании',
  approved: 'Согласован',
  rejected: 'Отклонён',
  cancelled: 'Отозван',
  active: 'В отпуске',
  completed: 'Завершён',
};

const REQUEST_STATUS_TONE: Record<LeaveRequestStatus, keyof typeof styles> = {
  pending: 'warn',
  approved: 'ok',
  rejected: 'bad',
  cancelled: 'neutral',
  active: 'info',
  completed: 'neutral',
};

const DOCUMENT_STATUS_LABEL: Record<DocumentStatus, string> = {
  formed: 'Сформирован',
  to_sign: 'На подписи',
  signed: 'Подписан',
  in_accounting: 'Передан в бухгалтерию',
  archived: 'В архиве',
  annulled: 'Аннулирован',
};

const DOCUMENT_STATUS_TONE: Record<DocumentStatus, keyof typeof styles> = {
  formed: 'neutral',
  to_sign: 'warn',
  signed: 'ok',
  in_accounting: 'info',
  archived: 'neutral',
  annulled: 'bad',
};

function Badge({ tone, label }: { tone: keyof typeof styles; label: string }) {
  return (
    <span className={`${styles.badge} ${styles[tone]}`}>
      <span className={styles.dot} aria-hidden />
      {label}
    </span>
  );
}

export function RequestStatusBadge({ status }: { status: LeaveRequestStatus }) {
  return <Badge tone={REQUEST_STATUS_TONE[status]} label={REQUEST_STATUS_LABEL[status]} />;
}

export function DocumentStatusBadge({ status }: { status: DocumentStatus }) {
  return <Badge tone={DOCUMENT_STATUS_TONE[status]} label={DOCUMENT_STATUS_LABEL[status]} />;
}

export type DeadlineTone = 'onTime' | 'dueSoon' | 'overdue';

export function DeadlineBadge({ tone, label }: { tone: DeadlineTone; label: string }) {
  const toneClass = tone === 'overdue' ? 'bad' : tone === 'dueSoon' ? 'warn' : 'info';
  return (
    <span className={`${styles.deadline} ${styles[toneClass]}`}>
      <span aria-hidden>⏰</span>
      {label}
    </span>
  );
}
