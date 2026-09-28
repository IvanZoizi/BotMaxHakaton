import { useNavigate } from 'react-router-dom';
import { ListHeader } from '../../components/Header';
import { BottomNav } from '../../components/BottomNav';
import styles from './Settings.module.css';

const ROWS: { label: string; value: string; to?: string }[] = [
  { label: 'Основания и нормы расчёта', value: 'ст. 115, 122, 123 ТК РФ', to: '/admin/settings/rules' },
  { label: 'Подразделения', value: '1' },
  { label: 'Роли и доступы', value: '4' },
  { label: 'Уведомления', value: 'Включены' },
  { label: 'Тема оформления', value: 'Системная' },
  { label: 'Демо-данные', value: 'Включены' },
];

export default function Settings() {
  const navigate = useNavigate();
  return (
    <div className="screen">
      <ListHeader title="Настройки" />
      <div className="screen-content screen-content--tight">
        {ROWS.map((row) => (
          <button key={row.label} type="button" className={styles.row} onClick={() => row.to && navigate(row.to)}>
            <span className={styles.label}>{row.label}</span>
            <span className={styles.value}>{row.value} ›</span>
          </button>
        ))}
      </div>
      <BottomNav role="admin" />
    </div>
  );
}
