import { usePersona } from '../context/AuthContext';
import type { Role } from '../api/types';
import styles from './DevRoleSwitcher.module.css';

const ROLE_LABELS: Record<Role, string> = {
  employee: 'Сотрудник',
  manager: 'Руководитель',
  accountant: 'Бухгалтер',
  admin: 'Админ',
};

/**
 * Продовый аналог DevRoleSwitcher для реального сотрудника с несколькими
 * ролями (например, владелец компании — он же руководитель точки). Скрыт,
 * если роль одна: тогда переключаться не между чем.
 */
export function RoleSwitcher() {
  const persona = usePersona();
  if (persona.roles.length <= 1) return null;

  return (
    <div className={styles.bar}>
      {persona.roles.map((r) => (
        <button
          key={r}
          type="button"
          className={`${styles.btn} ${persona.role === r ? styles.active : ''}`}
          onClick={() => persona.setRole(r)}
        >
          {ROLE_LABELS[r]}
        </button>
      ))}
    </div>
  );
}
