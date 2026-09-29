import { NavLink } from 'react-router-dom';
import { useAsync } from '../lib/useAsync';
import { listLeaveRequests } from '../api/client';
import styles from './BottomNav.module.css';

interface NavItemConfig {
  to: string;
  label: string;
  icon: string;
}

/**
 * Tab sets per role. Employee's four tabs come directly from Figma
 * (page 02 — Components → "Bottom Navigation/Employee": Главная, График,
 * Документы, Подработка). Manager/Accountant/Admin tab bars aren't in the
 * shared Figma file yet — composed from the screens each role does have,
 * using the same Nav Item visual language (glyph + label, active = primary
 * text, inactive = tertiary text).
 */
const NAV_BY_ROLE: Record<string, NavItemConfig[]> = {
  employee: [
    { to: '/employee/home', label: 'Главная', icon: '⌂' },
    { to: '/employee/team-calendar', label: 'График', icon: '▤' },
    { to: '/employee/documents', label: 'Документы', icon: '▦' },
    { to: '/employee/availability', label: 'Подработка', icon: '↗' },
  ],
  manager: [
    { to: '/manager/inbox', label: 'Входящие', icon: '☰' },
    { to: '/manager/team', label: 'Команда', icon: '▤' },
  ],
  accountant: [
    { to: '/accountant/registry', label: 'Реестр', icon: '▦' },
    { to: '/accountant/deadlines', label: 'Сроки', icon: '⏰' },
    { to: '/accountant/review-queue', label: 'К проверке', icon: '☰' },
    { to: '/accountant/audit', label: 'Журнал', icon: '▤' },
  ],
  admin: [
    { to: '/admin/employees', label: 'Сотрудники', icon: '▤' },
    { to: '/admin/settings', label: 'Настройки', icon: '⚙' },
  ],
};

export function BottomNav({ role }: { role: string }) {
  const items = NAV_BY_ROLE[role] ?? [];

  // Nav Item's badge counter (Figma page 02 — Components → Navigation) is
  // demonstrated specifically on "Входящие" — wire it to the real pending count.
  const { data: inbox } = useAsync(
    () => (role === 'manager' ? listLeaveRequests('inbox') : Promise.resolve(null)),
    [role],
  );
  const pendingCount = inbox?.filter((r) => r.status === 'pending').length ?? 0;

  if (items.length === 0) return null;

  return (
    <nav className={styles.nav}>
      {items.map((item) => {
        const badge = item.to === '/manager/inbox' && pendingCount > 0 ? pendingCount : undefined;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `${styles.item} ${isActive ? styles.active : ''}`}
          >
            <span className={styles.iconWrap}>
              {item.icon}
              {!!badge && <span className={styles.badge}>{badge}</span>}
            </span>
            <span className={styles.label}>{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
