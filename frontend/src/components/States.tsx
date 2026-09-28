import styles from './States.module.css';

/** Screen-level loading placeholder — a skeleton, never a full-screen spinner. */
export function SkeletonScreen() {
  return (
    <div className={styles.skeleton}>
      <div className={styles.bar} style={{ width: 180, height: 28 }} />
      <div className={styles.bar} style={{ width: '100%', height: 90 }} />
      <div className={styles.bar} style={{ width: 280, height: 18 }} />
      <div className={styles.bar} style={{ width: '100%', height: 56 }} />
      <div className={styles.bar} style={{ width: '100%', height: 56 }} />
    </div>
  );
}

interface EmptyStateProps {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ message, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className={styles.empty}>
      <div className={styles.emptyGlyph} aria-hidden />
      <p className={styles.emptyMessage}>{message}</p>
      {actionLabel && (
        <button type="button" className={styles.emptyAction} onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

interface ErrorStateProps {
  message?: string;
  onRetry: () => void;
}

export function ErrorState({ message = 'Не удалось загрузить. Проверьте интернет', onRetry }: ErrorStateProps) {
  return (
    <div className={styles.error}>
      <p className={styles.errorMessage}>{message}</p>
      <button type="button" className={styles.retry} onClick={onRetry}>
        Повторить
      </button>
    </div>
  );
}

export function DemoDataBadge() {
  return <div className={styles.demoBadge}>Данные смоделированы для демонстрации</div>;
}

/** 403 FORBIDDEN — distinct from network/server errors (page 07 — States, "4. Forbidden"). */
export function ForbiddenState({ message = 'Это действие недоступно для вашей роли' }: { message?: string }) {
  return (
    <div className={styles.forbidden}>
      <p className={styles.forbiddenIcon}>🔒</p>
      <p className={styles.forbiddenTitle}>Недостаточно прав</p>
      <p className={styles.forbiddenMessage}>{message}</p>
    </div>
  );
}
