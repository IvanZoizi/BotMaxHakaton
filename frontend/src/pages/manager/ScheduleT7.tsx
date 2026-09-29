import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Header } from '../../components/Header';
import { Button } from '../../components/Button';
import { SkeletonScreen, ErrorState, EmptyState } from '../../components/States';
import { approveScheduleT7, listScheduleT7 } from '../../api/client';
import { ApiError } from '../../api/errors';
import { useAsync } from '../../lib/useAsync';
import { formatRange } from '../../lib/date';

/** №24: руководитель видит все поданные предпочтения по году и конфликты
 * (пересекающиеся даты у разных сотрудников), утверждает график целиком. */
export default function ScheduleT7Review() {
  const { year = '' } = useParams();
  const yearNum = Number(year);
  const { data: entries, loading, error, reload } = useAsync(() => listScheduleT7(yearNum), [yearNum]);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleApprove() {
    setBusy(true);
    setActionError(null);
    try {
      await approveScheduleT7({ year: yearNum });
      reload();
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : 'Не удалось утвердить график');
    } finally {
      setBusy(false);
    }
  }

  const hasProposed = entries?.some((e) => e.status === 'proposed') ?? false;

  return (
    <div className="screen">
      <Header title={`График Т-7 · ${year}`} />
      <div className="screen-content">
        {loading && <SkeletonScreen />}
        {!loading && error && <ErrorState onRetry={reload} />}
        {!loading && !error && entries?.length === 0 && <EmptyState message="Пока никто не ответил" />}
        {!loading &&
          !error &&
          entries?.map((entry) => (
            <div key={entry.id} className="bordered-row">
              <p>{entry.fullName}</p>
              <p>
                {formatRange(entry.startDate, entry.endDate)} ·{' '}
                {entry.status === 'approved' ? 'утверждено' : 'предложено'}
              </p>
              {!!entry.conflictsWith.length && <p>⚠ Пересекается с {entry.conflictsWith.length} коллегами</p>}
            </div>
          ))}
        {actionError && <p>{actionError}</p>}
        {hasProposed && (
          <Button loading={busy} onClick={handleApprove}>
            Утвердить график
          </Button>
        )}
      </div>
    </div>
  );
}
