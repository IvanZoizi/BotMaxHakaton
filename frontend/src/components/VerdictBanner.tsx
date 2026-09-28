import type { VerdictLevel } from '../api/types';
import styles from './VerdictBanner.module.css';

const HEADLINE: Record<VerdictLevel, string> = {
  green: 'Можно',
  yellow: 'Можно, но обратите внимание',
  red: 'Нельзя',
};

const ICON: Record<VerdictLevel, string> = {
  green: '✓',
  yellow: '!',
  red: '✕',
};

const TONE: Record<VerdictLevel, string> = {
  green: styles.ok,
  yellow: styles.warn,
  red: styles.bad,
};

interface VerdictBannerProps {
  level: VerdictLevel;
  detail: string;
  headline?: string;
}

export function VerdictBanner({ level, detail, headline }: VerdictBannerProps) {
  return (
    <div className={`${styles.banner} ${TONE[level]}`}>
      <div className={styles.headline}>
        <span aria-hidden>{ICON[level]}</span>
        <span>{headline ?? HEADLINE[level]}</span>
      </div>
      <p className={styles.detail}>{detail}</p>
    </div>
  );
}
