import { ListHeader } from '../../components/Header';
import { BottomNav } from '../../components/BottomNav';
import { SkeletonScreen, ErrorState, EmptyState } from '../../components/States';
import { listAllDocumentsWithOwner } from '../../api/client';
import { useAsync } from '../../lib/useAsync';
import styles from './ReviewQueue.module.css';

export default function ReviewQueue() {
  const { data: documents, loading, error, reload } = useAsync(listAllDocumentsWithOwner, []);
  const items =
    documents
      ?.filter((d) => d.status === 'signed' || d.status === 'to_sign')
      .map((d) => ({
        id: d.id,
        title: `${d.number} · ${d.ownerName}`,
        note:
          d.status === 'signed'
            ? 'Подписан обеими сторонами — требуется зарегистрировать в журнале'
            : 'Ожидает подписи — проверьте срок',
      })) ?? [];

  return (
    <div className="screen">
      <ListHeader title="К проверке" />
      <div className="screen-content">
        {loading && <SkeletonScreen />}
        {!loading && error && <ErrorState onRetry={reload} />}
        {!loading && !error && items.length === 0 && <EmptyState message="Нечего проверять" />}
        {!loading &&
          !error &&
          items.map((item) => (
            <div key={item.id} className={`bordered-row ${styles.row}`}>
              <p className={styles.title}>{item.title}</p>
              <p className={styles.note}>{item.note}</p>
            </div>
          ))}
      </div>
      <BottomNav role="accountant" />
    </div>
  );
}
