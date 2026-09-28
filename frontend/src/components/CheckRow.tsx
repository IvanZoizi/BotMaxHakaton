import type { CheckResult } from '../api/types';
import styles from './CheckRow.module.css';

const TYPE_LABEL: Record<CheckResult['type'], string> = {
  law: 'Закон',
  calculation: 'Расчёт',
  company: 'Правило компании',
};

function toneFor(result: CheckResult) {
  if (!result.passed && result.severity === 'block') return styles.bad;
  if (!result.passed || result.severity === 'warn') return styles.warn;
  return styles.ok;
}

function iconFor(result: CheckResult) {
  if (!result.passed && result.severity === 'block') return '✕';
  if (!result.passed || result.severity === 'warn') return '!';
  return '✓';
}

interface CheckRowProps {
  check: CheckResult;
  onOpenRule?: (check: CheckResult) => void;
}

export function CheckRow({ check, onOpenRule }: CheckRowProps) {
  const tone = toneFor(check);
  return (
    <button
      type="button"
      className={styles.row}
      onClick={() => onOpenRule?.(check)}
      disabled={!onOpenRule}
    >
      <span className={`${styles.icon} ${tone}`} aria-hidden>
        {iconFor(check)}
      </span>
      <span className={styles.textCol}>
        <span className={styles.message}>{check.message}</span>
        <span className={styles.meta}>
          {check.norm && (
            <span className={styles.metaText}>
              {check.norm.title} · актуально на {formatDate(check.checkedAt)}
            </span>
          )}
          <span className={styles.typeTag}>{TYPE_LABEL[check.type]}</span>
        </span>
      </span>
    </button>
  );
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}
