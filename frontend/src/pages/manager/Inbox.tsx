import { useNavigate } from 'react-router-dom';
import { ListHeader } from '../../components/Header';
import { EmployeeRow } from '../../components/EmployeeRow';
import { RequestStatusBadge } from '../../components/StatusBadge';
import { BottomNav } from '../../components/BottomNav';
import { SkeletonScreen, ErrorState, EmptyState, ForbiddenState } from '../../components/States';
import { listLeaveRequests } from '../../api/mockApi';
import { EMPLOYEE_BALANCE_DAYS } from '../../api/fixtures';
import { useAsync } from '../../lib/useAsync';
import { formatRange } from '../../lib/date';
import type { LeaveRequestSummary } from '../../api/types';
import styles from './Inbox.module.css';

function employeeSubtitle(employee: LeaveRequestSummary['employee']) {
  const balance = EMPLOYEE_BALANCE_DAYS[employee.id];
  const parts = [employee.position, employee.locationName];
  if (balance !== undefined) parts.push(`остаток ${balance} дней`);
  return parts.filter(Boolean).join(' · ');
}

export default function Inbox() {
  const navigate = useNavigate();
  const { data: requests, loading, error, reload } = useAsync(() => listLeaveRequests('inbox'), []);

  const pending = requests?.filter((r) => r.status === 'pending') ?? [];
  const resolved = requests?.filter((r) => r.status !== 'pending') ?? [];

  function renderRow(r: LeaveRequestSummary) {
    return (
      <button key={r.id} type="button" className={styles.row} onClick={() => navigate(`/manager/requests/${r.id}`)}>
        <EmployeeRow fullName={r.employee.fullName} subtitle={employeeSubtitle(r.employee)} />
        <div className={styles.bottomRow}>
          <span>
            {formatRange(r.startDate, r.endDate)} · {r.calendarDays} дней
          </span>
          <RequestStatusBadge status={r.status} />
        </div>
      </button>
    );
  }

  return (
    <div className="screen">
      <ListHeader title="Входящие" />
      <div className="screen-content">
        {loading && <SkeletonScreen />}
        {!loading && error?.code === 'FORBIDDEN' && (
          <ForbiddenState message="Входящие заявки доступны только руководителю" />
        )}
        {!loading && error && error.code !== 'FORBIDDEN' && <ErrorState onRetry={reload} />}
        {!loading && !error && requests?.length === 0 && <EmptyState message="Входящих заявок пока нет" />}

        {!loading && !error && pending.length > 0 && (
          <section className={styles.section}>
            <p className={styles.sectionTitle}>Ждут решения</p>
            {pending.map(renderRow)}
          </section>
        )}

        {!loading && !error && resolved.length > 0 && (
          <section className={styles.section}>
            <p className={styles.sectionTitle}>Решённые</p>
            {resolved.map(renderRow)}
          </section>
        )}
      </div>
      <BottomNav role="manager" />
    </div>
  );
}
