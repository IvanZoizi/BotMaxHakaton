import { useParams } from 'react-router-dom';
import { Header } from '../../components/Header';
import { Button } from '../../components/Button';
import { SignatureStamp } from '../../components/DocumentCard';
import { DocumentStatusBadge } from '../../components/StatusBadge';
import { SkeletonScreen, ErrorState } from '../../components/States';
import { getDocument } from '../../api/client';
import { useAsync } from '../../lib/useAsync';
import { formatDateTime } from '../../lib/date';
import { maxBridge } from '../../bridge/maxBridge';
import styles from './DocumentDetail.module.css';

const KIND_LABEL: Record<string, string> = {
  application: 'Заявление',
  order_t6: 'Приказ Т-6',
  schedule_t7: 'График Т-7',
  notice: 'Уведомление',
};

export default function DocumentDetail() {
  const { id = '' } = useParams();
  const { data: doc, loading, error, reload } = useAsync(() => getDocument(id), [id]);

  if (loading) {
    return (
      <div className="screen">
        <Header title="Документ" />
        <SkeletonScreen />
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className="screen">
        <Header title="Документ" />
        <ErrorState onRetry={reload} />
      </div>
    );
  }

  return (
    <div className="screen">
      <Header title={KIND_LABEL[doc.kind] ?? doc.number} />
      <div className="screen-content">
        <div className={styles.row}>
          <p className={styles.number}>{doc.number}</p>
          <DocumentStatusBadge status={doc.status} />
        </div>
        <div className={styles.pdfPreview}>PDF preview</div>

        {doc.integrityVerified && (
          <p className={styles.integrity}>✓ Документ не изменялся после подписания</p>
        )}

        {doc.signers
          .filter((s) => s.signedAt)
          .map((s) => (
            <SignatureStamp
              key={s.employeeId}
              signerName={s.fullName}
              signedAt={formatDateTime(s.signedAt!)}
              method={s.method ?? 'confirm'}
              code={s.employeeId.slice(-6)}
            />
          ))}

        {doc.signers.some((s) => !s.signedAt) && (
          <p className={styles.pending}>
            Ожидает подписи: {doc.signers.find((s) => !s.signedAt)!.fullName}
          </p>
        )}

        <Button onClick={() => maxBridge.downloadFile(doc.pdfUrl, `${doc.number}.pdf`)}>Скачать</Button>
        <Button
          variant="text"
          onClick={() => maxBridge.shareMaxContent({ title: doc.number, url: doc.pdfUrl })}
        >
          Отправить в чат
        </Button>
      </div>
    </div>
  );
}
