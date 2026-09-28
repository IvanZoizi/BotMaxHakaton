import { useSyncExternalStore } from 'react';
import { usePersona } from '../context/AuthContext';
import { getTheme, setTheme, subscribeTheme } from '../context/themeStore';
import type { Role } from '../api/types';
import styles from './DevRoleSwitcher.module.css';

const ROLES: { key: Role; label: string }[] = [
  { key: 'employee', label: 'Сотрудник' },
  { key: 'manager', label: 'Руководитель' },
  { key: 'accountant', label: 'Бухгалтер' },
  { key: 'admin', label: 'Админ' },
];

/**
 * Dev-only affordance, not part of the Figma design: the real app resolves
 * the role from MAX `initData` server-side, so there is nothing to switch in
 * production. Lets every role/screen be reached in a plain browser preview.
 */
export function DevRoleSwitcher() {
  const persona = usePersona();
  const theme = useSyncExternalStore(subscribeTheme, getTheme, getTheme);
  return (
    <div className={styles.bar}>
      <span className={styles.tag}>DEV</span>
      {ROLES.map((r) => (
        <button
          key={r.key}
          type="button"
          className={`${styles.btn} ${persona.role === r.key ? styles.active : ''}`}
          onClick={() => persona.setRole(r.key)}
        >
          {r.label}
        </button>
      ))}
      <button
        type="button"
        className={`${styles.btn} ${!persona.isLinked ? styles.activeWarn : ''}`}
        onClick={() => persona.setLinked(!persona.isLinked)}
      >
        {persona.isLinked ? 'isLinked' : 'NOT_LINKED'}
      </button>
      <button
        type="button"
        className={styles.btn}
        onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
      >
        {theme === 'light' ? '☀ light' : '🌙 dark'}
      </button>
    </div>
  );
}
