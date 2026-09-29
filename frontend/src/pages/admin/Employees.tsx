import { useState } from 'react';
import { ListHeader } from '../../components/Header';
import { EmployeeRow } from '../../components/EmployeeRow';
import { BottomNav } from '../../components/BottomNav';
import { Button } from '../../components/Button';
import { SkeletonScreen, ErrorState } from '../../components/States';
import { listEmployees, updateEmployee } from '../../api/client';
import { EMPLOYEE_BALANCE_DAYS } from '../../api/fixtures';
import { useAsync } from '../../lib/useAsync';
import { ApiError } from '../../api/errors';
import type { Role } from '../../api/types';
import styles from './Employees.module.css';

// README §9 №15 / api/app/rules/checks.py PRIVILEGED_CATEGORIES + EXTENDED_BASE_DURATION.
const CATEGORY_LABELS: Record<string, string> = {
  multiple_children: 'Многодетный родитель',
  minor: 'Младше 18 лет',
  donor: 'Почётный донор',
  chernobyl: 'Пострадавший от радиационных аварий',
  spouse_of_military: 'Супруг(а) военнослужащего',
  disabled: 'Инвалид',
  pregnant_or_postnatal: 'Беременность / отпуск по уходу',
  adopted_infant: 'Усыновивший ребёнка до 3 месяцев',
};

const ALL_ROLES: Role[] = ['employee', 'manager', 'accountant', 'admin'];

export default function Employees() {
  const { data: employees, loading, error, reload } = useAsync(listEmployees, []);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [category, setCategory] = useState('');
  const [roles, setRoles] = useState<Role[]>([]);
  const [skillsText, setSkillsText] = useState('');

  function startEdit(id: string, current: { category?: string | null; roles?: Role[]; skills?: string[] }) {
    setEditingId(id);
    setCategory(current.category ?? '');
    setRoles(current.roles ?? ['employee']);
    setSkillsText((current.skills ?? []).join(', '));
    setFormError(null);
  }

  function toggleRole(role: Role) {
    setRoles((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]));
  }

  async function save(id: string) {
    setBusy(true);
    setFormError(null);
    try {
      const skills = skillsText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      await updateEmployee(id, { category: category || null, roles, skills });
      setEditingId(null);
      reload();
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : 'Не удалось сохранить');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen">
      <ListHeader title="Сотрудники" />
      <div className="screen-content">
        {loading && <SkeletonScreen />}
        {!loading && error && <ErrorState onRetry={reload} />}
        {!loading &&
          !error &&
          employees?.map((e) => {
            const balance = EMPLOYEE_BALANCE_DAYS[e.id];
            const subtitle = [e.position, e.locationName, balance !== undefined ? `остаток ${balance} дней` : null]
              .filter(Boolean)
              .join(' · ');
            const isEditing = editingId === e.id;
            return (
              <div key={e.id} className={styles.row}>
                <button type="button" className={styles.rowButton} onClick={() => startEdit(e.id, e)}>
                  <EmployeeRow fullName={e.fullName} subtitle={subtitle} />
                </button>
                {e.category && !isEditing && (
                  <p className={styles.categoryTag}>{CATEGORY_LABELS[e.category] ?? e.category}</p>
                )}
                {isEditing && (
                  <div className={styles.editPanel}>
                    <label className={styles.fieldLabel}>Льготная категория</label>
                    <select
                      className={styles.select}
                      value={category}
                      onChange={(ev) => setCategory(ev.target.value)}
                    >
                      <option value="">Нет</option>
                      {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <label className={styles.fieldLabel}>Допуски (через запятую)</label>
                    <input
                      className={styles.select}
                      value={skillsText}
                      onChange={(ev) => setSkillsText(ev.target.value)}
                      placeholder="ккт, алкоголь"
                    />
                    <label className={styles.fieldLabel}>Роли</label>
                    <div className={styles.roleList}>
                      {ALL_ROLES.map((r) => (
                        <label key={r} className={styles.roleOption}>
                          <input type="checkbox" checked={roles.includes(r)} onChange={() => toggleRole(r)} />
                          {r}
                        </label>
                      ))}
                    </div>
                    {formError && <p className={styles.categoryTag}>{formError}</p>}
                    <div className={styles.editActions}>
                      <Button variant="text" onClick={() => setEditingId(null)}>
                        Отмена
                      </Button>
                      <Button loading={busy} onClick={() => save(e.id)}>
                        Сохранить
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
      </div>
      <BottomNav role="admin" />
    </div>
  );
}
