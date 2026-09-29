import { useSyncExternalStore } from 'react';
import { useNavigate } from 'react-router-dom';
import { ListHeader } from '../../components/Header';
import { BottomNav } from '../../components/BottomNav';
import { getCompanySummary } from '../../api/client';
import { useAsync } from '../../lib/useAsync';
import { getTheme, setTheme, subscribeTheme } from '../../context/themeStore';
import styles from './Settings.module.css';

export default function Settings() {
  const navigate = useNavigate();
  const theme = useSyncExternalStore(subscribeTheme, getTheme, getTheme);
  const { data: summary } = useAsync(getCompanySummary, []);

  const rows: { label: string; value: string; onClick?: () => void }[] = [
    {
      label: 'Основания и нормы расчёта',
      value: 'ст. 115, 122, 123 ТК РФ',
      onClick: () => navigate('/admin/settings/rules'),
    },
    {
      label: 'Роли и доступы',
      value: summary ? `${summary.employeesInvited} сотрудников` : '…',
      onClick: () => navigate('/admin/employees'),
    },
    {
      // Своего экрана со списком точек и добавлением новой пока нет —
      // POST /locations на бэкенде есть (routers/companies.py), но без
      // GET-списка строить полноценное управление подразделениями рано.
      label: 'Подразделения',
      value: summary ? `${summary.locations}` : '…',
    },
    {
      label: 'Тема оформления',
      value: theme === 'dark' ? 'Тёмная' : 'Светлая',
      onClick: () => setTheme(theme === 'dark' ? 'light' : 'dark'),
    },
  ];

  return (
    <div className="screen">
      <ListHeader title="Настройки" />
      <div className="screen-content screen-content--tight">
        {rows.map((row) => (
          <button
            key={row.label}
            type="button"
            className={styles.row}
            onClick={row.onClick}
            disabled={!row.onClick}
          >
            <span className={styles.label}>{row.label}</span>
            <span className={styles.value}>
              {row.value}
              {row.onClick && ' ›'}
            </span>
          </button>
        ))}
      </div>
      <BottomNav role="admin" />
    </div>
  );
}
