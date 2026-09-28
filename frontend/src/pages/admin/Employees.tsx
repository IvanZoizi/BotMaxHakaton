import { ListHeader } from '../../components/Header';
import { EmployeeRow } from '../../components/EmployeeRow';
import { BottomNav } from '../../components/BottomNav';
import { SkeletonScreen, ErrorState } from '../../components/States';
import { listEmployees } from '../../api/mockApi';
import { EMPLOYEE_BALANCE_DAYS } from '../../api/fixtures';
import { useAsync } from '../../lib/useAsync';
import styles from './Employees.module.css';

export default function Employees() {
  const { data: employees, loading, error, reload } = useAsync(listEmployees, []);

  return (
    <div className="screen">
      <ListHeader title="Сотрудники" />
      <div className="screen-content">
        <p className={styles.gapNote}>
          ⚠ CRUD сотрудников не задокументирован (GAP-06) — список только для чтения, из демо-данных.
        </p>
        {loading && <SkeletonScreen />}
        {!loading && error && <ErrorState onRetry={reload} />}
        {!loading &&
          !error &&
          employees?.map((e) => {
            const balance = EMPLOYEE_BALANCE_DAYS[e.id];
            const subtitle = [e.position, e.locationName, balance !== undefined ? `остаток ${balance} дней` : null]
              .filter(Boolean)
              .join(' · ');
            return (
              <div key={e.id} className={styles.row}>
                <EmployeeRow fullName={e.fullName} subtitle={subtitle} />
              </div>
            );
          })}
      </div>
      <BottomNav role="admin" />
    </div>
  );
}
