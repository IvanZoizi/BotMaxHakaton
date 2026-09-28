import { useNavigate } from 'react-router-dom';
import { Header } from '../../components/Header';
import { DocumentCard } from '../../components/DocumentCard';
import { DocumentStatusBadge } from '../../components/StatusBadge';
import { BottomNav } from '../../components/BottomNav';
import { SkeletonScreen, ErrorState, EmptyState } from '../../components/States';
import { listLeaveRequests } from '../../api/mockApi';
import { useAsync } from '../../lib/useAsync';
import { formatRuDateTimeLong } from '../../lib/date';
import { documentStatusText } from '../../lib/documentStatusText';
import styles from './MyDocuments.module.css';

const KIND_LABEL: Record<string, string> = {
  application: 'Заявление',
  order_t6: 'Приказ Т-6',
  schedule_t7: 'График Т-7',
  notice: 'Уведомление',
};

export default function MyDocuments() {
  const navigate = useNavigate();
  const { data: requests, loading, error, reload } = useAsync(() => listLeaveRequests('mine'), []);
  const documents = requests?.flatMap((r) => r.documents) ?? [];

  return (
    <div className="screen">
      <Header title="Мои документы" />
      <div className="screen-content">
        {loading && <SkeletonScreen />}
        {!loading && error && <ErrorState onRetry={reload} />}
        {!loading && !error && documents.length === 0 && (
          <EmptyState message="Документов пока нет" actionLabel="Оформить отпуск" onAction={() => navigate('/employee/new-request')} />
        )}
        {!loading &&
          !error &&
          documents.map((doc) => (
            <div key={doc.id} className={styles.entry}>
              <DocumentCard
                title={KIND_LABEL[doc.kind] ?? doc.number}
                subtitle={`от ${formatRuDateTimeLong(doc.issuedAt)} · ${documentStatusText(doc.status)}`}
                onClick={() => navigate(`/employee/documents/${doc.id}`)}
              />
              <DocumentStatusBadge status={doc.status} />
            </div>
          ))}
      </div>
      <BottomNav role="employee" />
    </div>
  );
}
