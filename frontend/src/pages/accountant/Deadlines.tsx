import { useState } from 'react';
import { ListHeader } from '../../components/Header';
import { DeadlineBadge } from '../../components/StatusBadge';
import { Button } from '../../components/Button';
import { BottomNav } from '../../components/BottomNav';
import { SkeletonScreen, ErrorState, EmptyState } from '../../components/States';
import { listPaymentDeadlines, markPaid } from '../../api/client';
import { useAsync } from '../../lib/useAsync';
import { diffDays, formatRu } from '../../lib/date';
import { DEMO_TODAY_ISO } from '../../api/client';
import styles from './Deadlines.module.css';

function amountFor(chargeableDays: number) {
  return (chargeableDays * 2400).toLocaleString('ru-RU') + ' ₽';
}

function toneFor(payDeadline: string): 'onTime' | 'dueSoon' | 'overdue' {
  const days = diffDays(DEMO_TODAY_ISO, payDeadline);
  if (days < 0) return 'overdue';
  if (days <= 1) return 'dueSoon';
  return 'onTime';
}

export default function Deadlines() {
  const { data: requests, loading, error, reload } = useAsync(listPaymentDeadlines, []);
  const [paid, setPaid] = useState<Set<string>>(new Set());

  return (
    <div className="screen">
      <ListHeader title="Сроки выплат" />
      <div className="screen-content">
        <p className={styles.gapNote}>
          ⚠ Списочного endpoint'а и действия отметки выплаты нет в контракте (GAP-04) — показано на
          основе payDeadline из заявок.
        </p>
        {loading && <SkeletonScreen />}
        {!loading && error && <ErrorState onRetry={reload} />}
        {!loading && !error && requests?.length === 0 && <EmptyState message="Ближайших выплат нет" />}
        {!loading &&
          !error &&
          requests
            ?.filter((r) => !paid.has(r.id))
            .map((r) => {
              const tone = toneFor(r.payDeadline);
              const label =
                tone === 'overdue'
                  ? `Просрочено: выплатить отпускные до ${formatRu(r.payDeadline)}`
                  : tone === 'dueSoon'
                    ? `Выплатить отпускные до ${formatRu(r.payDeadline)} — скоро`
                    : `Выплатить отпускные до ${formatRu(r.payDeadline)}`;
              return (
                <div key={r.id} className={`bordered-row ${styles.row}`}>
                  <p className={styles.name}>{r.employee.fullName}</p>
                  <p className={styles.amount}>Отпускные · {amountFor(r.chargeableDays)}</p>
                  <DeadlineBadge tone={tone} label={label} />
                  <Button
                    variant="text"
                    onClick={async () => {
                      await markPaid(r.id);
                      setPaid((prev) => new Set(prev).add(r.id));
                    }}
                  >
                    Отметить выплату
                  </Button>
                </div>
              );
            })}
      </div>
      <BottomNav role="accountant" />
    </div>
  );
}
