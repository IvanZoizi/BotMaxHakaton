import styles from './EmployeeRow.module.css';

/**
 * Names are stored "Фамилия Имя Отчество" (surname first), but Figma's
 * Avatar initials read given-name-first — "Петрова Марина Алексеевна" → "МП",
 * "Кузнецов Артём Павлович" → "АК" (confirmed on both the People component
 * and the Candidate Swipe Card). So: second word's initial + first word's.
 */
function initials(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  return (parts[1]?.[0] ?? '') + (parts[0]?.[0] ?? '');
}

export function Avatar({ fullName, size = 40 }: { fullName: string; size?: 40 | 56 }) {
  return (
    <div
      className={styles.avatar}
      style={{ width: size, height: size, fontSize: size === 56 ? 20 : 16 }}
    >
      {initials(fullName)}
    </div>
  );
}

interface EmployeeRowProps {
  fullName: string;
  subtitle: string;
  avatarSize?: 40 | 56;
}

export function EmployeeRow({ fullName, subtitle, avatarSize = 40 }: EmployeeRowProps) {
  return (
    <div className={styles.row}>
      <Avatar fullName={fullName} size={avatarSize} />
      <div className={styles.info}>
        <p className={styles.name}>{fullName}</p>
        <p className={styles.subtitle}>{subtitle}</p>
      </div>
    </div>
  );
}
