import { ListHeader } from '../../components/Header';
import { Button } from '../../components/Button';
import { BottomNav } from '../../components/BottomNav';
import { SkeletonScreen, ErrorState, EmptyState, ForbiddenState } from '../../components/States';
import { exportAuditPackage, listAudit } from '../../api/client';
import { useAsync } from '../../lib/useAsync';
import { formatDateTime } from '../../lib/date';
import { maxBridge } from '../../bridge/maxBridge';
import styles from './AuditJournal.module.css';

const ACTION_LABEL: Record<string, string> = {
  submit: 'Заявка подана',
  approve: 'Согласовано',
  reject: 'Отклонено',
  cancel: 'Отозвано',
  sign: 'Подписано',
};

export default function AuditJournal() {
  const { data: entries, loading, error, reload } = useAsync(() => listAudit({}), []);

  async function handleExport() {
    const { url, filename } = await exportAuditPackage('2026-09-01', '2026-12-31');
    await maxBridge.downloadFile(url, filename);
  }

  return (
    <div className="screen">
      <ListHeader title="Журнал" />
      <div className="screen-content">
        {loading && <SkeletonScreen />}
        {!loading && error?.code === 'FORBIDDEN' && (
          <ForbiddenState message="Журнал доступен руководителю, бухгалтеру и администратору" />
        )}
        {!loading && error && error.code !== 'FORBIDDEN' && <ErrorState onRetry={reload} />}
        {!loading && !error && entries?.length === 0 && <EmptyState message="Записей пока нет" />}
        {!loading &&
          !error &&
          entries?.map((e, i) => (
            <div key={i} className={styles.row}>
              <p className={styles.action}>
                {ACTION_LABEL[e.action] ?? e.action} · {e.actorName}
              </p>
              <p className={styles.meta}>{formatDateTime(e.occurredAt)}</p>
            </div>
          ))}
        <Button onClick={handleExport}>Собрать папку к проверке</Button>
      </div>
      <BottomNav role="accountant" />
    </div>
  );
}
