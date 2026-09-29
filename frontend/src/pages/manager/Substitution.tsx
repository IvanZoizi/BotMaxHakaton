import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../components/Button';
import { CandidateSwipeCard } from '../../components/CandidateSwipeCard';
import { EmptyState, ErrorState, ForbiddenState, SkeletonScreen } from '../../components/States';
import { createShiftOffer, getShiftContext, listShiftCandidates } from '../../api/client';
import { useAsync } from '../../lib/useAsync';
import { formatRange } from '../../lib/date';
import { surnameWithInitials } from '../../lib/formatName';
import styles from './Substitution.module.css';

export default function Substitution() {
  const { shiftId = 'shift-1' } = useParams();
  const navigate = useNavigate();
  const { data: candidates, loading, error, reload } = useAsync(() => listShiftCandidates(shiftId), [shiftId]);
  const { data: shiftContext } = useAsync(() => getShiftContext(shiftId), [shiftId]);
  const [index, setIndex] = useState(0);
  const [offered, setOffered] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);

  const remaining = (candidates ?? []).filter((c) => !offered.has(c.employeeId)).slice(index);
  const current = remaining[0];

  async function handleOffer() {
    if (!current) return;
    await createShiftOffer({ shiftId, employeeId: current.employeeId });
    setOffered((prev) => new Set(prev).add(current.employeeId));
    setToast(`Предложение отправлено: ${current.fullName}`);
    setTimeout(() => setToast(null), 2000);
  }

  function handleSkip() {
    setIndex((i) => i + 1);
  }

  return (
    <div className="screen">
      <header className={styles.header}>
        <button type="button" className={styles.back} onClick={() => navigate(-1)} aria-label="Назад">
          ←
        </button>
        <div className={styles.titleBlock}>
          <p className={styles.title}>Найти подмену</p>
          <p className={styles.subtitle}>
            {shiftContext
              ? `На время отпуска ${surnameWithInitials(shiftContext.employeeName)} · ${formatRange(shiftContext.startDate, shiftContext.endDate)}`
              : 'На время отпуска сотрудника'}
          </p>
        </div>
      </header>
      <div className="screen-content">
        {loading && <SkeletonScreen />}
        {!loading && error?.code === 'FORBIDDEN' && (
          <ForbiddenState message="Подбор подмены доступен только руководителю" />
        )}
        {!loading && error && error.code !== 'FORBIDDEN' && <ErrorState onRetry={reload} />}
        {!loading && !error && !current && <EmptyState message="Больше кандидатов нет" />}
        {!loading && !error && current && (
          <CandidateSwipeCard candidate={current} onSkip={handleSkip} onOffer={handleOffer} />
        )}
        {toast && <p className={styles.toast}>{toast}</p>}
        {!loading && !error && current && (
          <Button variant="text" onClick={handleSkip}>
            Показать другого кандидата
          </Button>
        )}
      </div>
    </div>
  );
}
