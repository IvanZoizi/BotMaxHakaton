import { ListHeader } from '../../components/Header';
import { EmployeeRow } from '../../components/EmployeeRow';
import { BottomNav } from '../../components/BottomNav';
import { SkeletonScreen, ErrorState, EmptyState } from '../../components/States';
import { getTeamCalendar } from '../../api/mockApi';
import { useAsync } from '../../lib/useAsync';
import { formatRange } from '../../lib/date';
import styles from './TeamCalendar.module.css';

export default function TeamCalendar() {
  const { data: entries, loading, error, reload } = useAsync(
    () => getTeamCalendar('2026-09-01', '2026-12-31'),
    [],
  );

  return (
    <div className="screen">
      <ListHeader title="График команды" />
      <div className="screen-content">
        <p className={styles.lead}>
          Кто из коллег уже в отпуске или согласовал даты — чтобы выбрать своё время без пересечений.
        </p>
        {loading && <SkeletonScreen />}
        {!loading && error && <ErrorState onRetry={reload} />}
        {!loading && !error && entries?.length === 0 && <EmptyState message="В ближайшее время коллеги не в отпуске" />}
        {!loading &&
          !error &&
          entries?.map((entry, i) => (
            <div key={`${entry.employeeId}-${i}`} className={styles.row}>
              <EmployeeRow fullName={entry.fullName} subtitle={formatRange(entry.startDate, entry.endDate)} />
            </div>
          ))}
      </div>
      <BottomNav role="employee" />
    </div>
  );
}
