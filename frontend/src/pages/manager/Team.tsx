import { ListHeader } from '../../components/Header';
import { EmployeeRow } from '../../components/EmployeeRow';
import { BottomNav } from '../../components/BottomNav';
import { SkeletonScreen, ErrorState, EmptyState } from '../../components/States';
import { getTeamCalendar, listLeaveRequests, DEMO_TODAY_ISO } from '../../api/mockApi';
import { EMPLOYEES, EMPLOYEE_BALANCE_DAYS } from '../../api/fixtures';
import { useAsync } from '../../lib/useAsync';
import { formatRu } from '../../lib/date';
import styles from './Team.module.css';

function employeeSubtitle(employeeId: string) {
  const employee = EMPLOYEES[employeeId];
  const balance = EMPLOYEE_BALANCE_DAYS[employeeId];
  const parts = [employee?.position, employee?.locationName];
  if (balance !== undefined) parts.push(`остаток ${balance} дней`);
  return parts.filter(Boolean).join(' · ');
}

export default function Team() {
  const { data, loading, error, reload } = useAsync(async () => {
    const [calendar, inbox] = await Promise.all([
      getTeamCalendar('2026-09-01', '2026-12-31'),
      listLeaveRequests('inbox'),
    ]);
    return { calendar, inbox };
  }, []);

  if (loading) {
    return (
      <div className="screen">
        <ListHeader title="Команда" />
        <SkeletonScreen />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="screen">
        <ListHeader title="Команда" />
        <ErrorState onRetry={reload} />
      </div>
    );
  }

  const roster = new Map<string, { fullName: string; status: string | null }>();
  data.calendar.forEach((entry) => {
    const onLeaveNow = entry.startDate <= DEMO_TODAY_ISO && entry.endDate >= DEMO_TODAY_ISO;
    roster.set(entry.employeeId, {
      fullName: entry.fullName,
      status: onLeaveNow ? `В отпуске сейчас · до ${formatRu(entry.endDate)}` : null,
    });
  });
  data.inbox
    .filter((r) => r.status === 'pending')
    .forEach((r) => {
      const existing = roster.get(r.employee.id);
      if (!existing || !existing.status) {
        roster.set(r.employee.id, { fullName: r.employee.fullName, status: 'Заявка на согласовании' });
      }
    });

  const rows = Array.from(roster.entries());

  return (
    <div className="screen">
      <ListHeader title="Команда" />
      <div className="screen-content">
        {rows.length === 0 && <EmptyState message="В команде пока нет активности" />}
        {rows.map(([id, { fullName, status }]) => (
          <div key={id} className={`bordered-row ${styles.row}`}>
            <EmployeeRow fullName={fullName} subtitle={employeeSubtitle(id)} />
            {status && <p className={styles.status}>{status}</p>}
          </div>
        ))}
      </div>
      <BottomNav role="manager" />
    </div>
  );
}
