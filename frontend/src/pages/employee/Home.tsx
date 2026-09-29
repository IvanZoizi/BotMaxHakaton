import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ListHeader } from '../../components/Header';
import { Button } from '../../components/Button';
import { BottomNav } from '../../components/BottomNav';
import { DocumentCard } from '../../components/DocumentCard';
import { SkeletonScreen, ErrorState, DemoDataBadge } from '../../components/States';
import { BottomSheet, SheetTitle, SheetText } from '../../components/BottomSheet';
import { getMe, listLeaveRequests } from '../../api/client';
import { useAsync } from '../../lib/useAsync';
import { formatRange, formatRu } from '../../lib/date';
import styles from './Home.module.css';

const STATUS_TEXT: Record<string, string> = {
  pending: 'Ждём решения руководителя',
  approved: 'Согласовано руководителем',
  active: 'Сейчас в отпуске',
  rejected: 'Отклонено руководителем',
};

export default function Home() {
  const navigate = useNavigate();
  const [howCalculated, setHowCalculated] = useState(false);
  const me = useAsync(getMe, []);
  const requests = useAsync(() => listLeaveRequests('mine'), []);

  if (me.loading || requests.loading) {
    return (
      <div className="screen">
        <ListHeader title="Главная" />
        <SkeletonScreen />
      </div>
    );
  }

  if (me.error || !me.data) {
    return (
      <div className="screen">
        <ListHeader title="Главная" />
        <ErrorState onRetry={me.reload} />
      </div>
    );
  }

  const current = requests.data?.find((r) => r.status === 'pending' || r.status === 'active' || r.status === 'approved');

  // "Needs my signature" means I'm listed as a pending signer on the
  // document — not just any document with an overall 'to_sign' status
  // (that also covers e.g. a manager's order awaiting the manager, not me).
  const toSign = requests.data?.flatMap((r) =>
    r.documents
      .filter((d) => d.signers.some((s) => s.employeeId === me.data!.id && !s.signedAt))
      .map((d) => ({ doc: d, notifyDeadline: r.notifyDeadline })),
  );

  return (
    <div className="screen">
      <ListHeader title="Главная" />
      {me.data.isDemo && <DemoDataBadge />}
      <div className="screen-content">
        <div className={styles.balance}>
          <p className={styles.balanceDays}>{me.data.leaveBalance.days} дней</p>
          <div className={styles.balanceMeta}>
            <span>на {formatAsOf(me.data.leaveBalance.asOf)}</span>
            <button type="button" className={styles.howLink} onClick={() => setHowCalculated(true)}>
              Как считается
            </button>
          </div>
        </div>

        {current && (
          <button type="button" className={styles.card} onClick={() => navigate(`/employee/requests/${current.id}`)}>
            <p className={styles.cardTitle}>
              Отпуск {formatRange(current.startDate, current.endDate)} · {current.calendarDays} дней
            </p>
            <p className={styles.cardSubtitle}>{STATUS_TEXT[current.status] ?? current.status}</p>
          </button>
        )}

        {!!toSign?.length && (
          <div>
            <p className={styles.sectionTitle}>Нужно подписать</p>
            <div className={styles.docList}>
              {toSign.map(({ doc, notifyDeadline }) => (
                <DocumentCard
                  key={doc.id}
                  title={doc.number}
                  subtitle={`Подпишите до ${formatRu(notifyDeadline)}`}
                  onClick={() => navigate(`/employee/documents/${doc.id}/sign`)}
                />
              ))}
            </div>
          </div>
        )}

        <div className={styles.spacer} />

        <Button onClick={() => navigate('/employee/new-request')}>Оформить отпуск</Button>
      </div>
      <BottomNav role="employee" />

      <BottomSheet open={howCalculated} onClose={() => setHowCalculated(false)}>
        <SheetTitle>Как считается остаток</SheetTitle>
        <SheetText>
          2,33 дня начисляется за каждый отработанный месяц + неиспользованные дни за прошлые годы.
        </SheetText>
        <Button onClick={() => setHowCalculated(false)}>Понятно</Button>
      </BottomSheet>
    </div>
  );
}

function formatAsOf(iso: string) {
  const [, m, d] = iso.split('-');
  const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  return `${Number(d)} ${months[Number(m) - 1]}`;
}
