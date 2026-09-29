import { useNavigate } from 'react-router-dom';
import { ListHeader } from '../../components/Header';
import { DocumentCard } from '../../components/DocumentCard';
import { DocumentStatusBadge } from '../../components/StatusBadge';
import { BottomNav } from '../../components/BottomNav';
import { SkeletonScreen, ErrorState, EmptyState } from '../../components/States';
import { listAllDocumentsWithOwner } from '../../api/client';
import { useAsync } from '../../lib/useAsync';
import { formatRuDateTimeLong } from '../../lib/date';
import { documentStatusText } from '../../lib/documentStatusText';
import styles from './Registry.module.css';

export default function Registry() {
  const navigate = useNavigate();
  const { data: documents, loading, error, reload } = useAsync(listAllDocumentsWithOwner, []);

  return (
    <div className="screen">
      <ListHeader title="Реестр документов" />
      <div className="screen-content">
        <p className={styles.gapNote}>
          ⚠ Списочного endpoint'а «все документы компании» нет в контракте (GAP-03) — здесь показаны
          все документы, известные моку.
        </p>
        {loading && <SkeletonScreen />}
        {!loading && error && <ErrorState onRetry={reload} />}
        {!loading && !error && documents?.length === 0 && <EmptyState message="Документов пока нет" />}
        {!loading &&
          !error &&
          documents?.map((doc) => (
            <div key={doc.id} className={styles.entry}>
              <DocumentCard
                title={doc.number}
                subtitle={`от ${formatRuDateTimeLong(doc.issuedAt)} · ${documentStatusText(doc.status, doc.ownerName)}`}
                onClick={() => navigate(`/accountant/documents/${doc.id}`)}
              />
              <DocumentStatusBadge status={doc.status} />
            </div>
          ))}
      </div>
      <BottomNav role="accountant" />
    </div>
  );
}
