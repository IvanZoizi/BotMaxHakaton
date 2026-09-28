import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './Header.module.css';

interface HeaderProps {
  title: string;
  onBack?: () => void;
  right?: ReactNode;
}

/** Standard screen header with a back arrow — 48px, used on every detail/form screen. */
export function Header({ title, onBack, right }: HeaderProps) {
  const navigate = useNavigate();
  const handleBack = onBack ?? (() => navigate(-1));
  return (
    <header className={styles.header}>
      <button type="button" className={styles.back} onClick={handleBack} aria-label="Назад">
        ←
      </button>
      <h1 className={styles.title}>{title}</h1>
      {right}
    </header>
  );
}

/** Title-only header (no back arrow) — 54px, used on top-level tab screens (Home, Inbox, Team…). */
export function ListHeader({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <header className={styles.listHeader}>
      <h1 className={styles.listTitle}>{title}</h1>
      {right}
    </header>
  );
}

/** Wizard step header with an eyebrow caption — 70px, used in Admin onboarding. */
export function StepHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <header className={styles.stepHeader}>
      <p className={styles.eyebrow}>{eyebrow}</p>
      <h1 className={styles.stepTitle}>{title}</h1>
    </header>
  );
}
