import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Header } from '../../components/Header';
import { Button } from '../../components/Button';
import { RequestStatusBadge } from '../../components/StatusBadge';
import { DocumentCard } from '../../components/DocumentCard';
import { SkeletonScreen, ErrorState, ForbiddenState } from '../../components/States';
import { getLeaveRequest, cancelLeaveRequest } from '../../api/mockApi';
import { ApiError } from '../../api/errors';
import { useAsync } from '../../lib/useAsync';
import { formatRange, formatRuDateTimeLong } from '../../lib/date';
import { documentStatusText } from '../../lib/documentStatusText';
import styles from './MyRequest.module.css';

const STATUS_TEXT: Record<string, (r: { rejectReason: string | null }) => string> = {
  pending: () => 'Ждём решения руководителя',
  approved: () => 'Согласовано руководителем',
  rejected: (r) => `Отклонено руководителем${r.rejectReason ? `. Причина: ${r.rejectReason}` : ''}`,
  cancelled: () => 'Заявка отменена сотрудником',
  active: () => 'Сейчас в отпуске',
  completed: () => 'Отпуск завершён',
};

export default function MyRequest() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const { data: request, loading, error, reload } = useAsync(() => getLeaveRequest(id), [id]);

  if (loading) {
    return (
      <div className="screen">
        <Header title="Моя заявка" />
        <SkeletonScreen />
      </div>
    );
  }

  if (error?.code === 'FORBIDDEN') {
    return (
      <div className="screen">
        <Header title="Моя заявка" />
        <ForbiddenState message="Эта заявка вам недоступна" />
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="screen">
        <Header title="Моя заявка" />
        <ErrorState onRetry={reload} />
      </div>
    );
  }

  async function handleCancel() {
    setBusy(true);
    setActionError(null);
    try {
      await cancelLeaveRequest(id);
      reload();
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : 'Не удалось отозвать заявку');
    } finally {
      setBusy(false);
    }
  }

  const signedDoc = request.documents.find((d) => d.status === 'signed' || d.status === 'to_sign' || d.status === 'in_accounting');

  return (
    <div className="screen">
      <Header title="Моя заявка" />
      <div className="screen-content">
        <RequestStatusBadge status={request.status} />
        <div className={styles.summaryCard}>
          <p className={styles.summaryTitle}>
            Отпуск {formatRange(request.startDate, request.endDate)} · {request.calendarDays} дней
          </p>
          <p className={styles.summarySubtitle}>{STATUS_TEXT[request.status]?.(request) ?? request.status}</p>
        </div>

        {signedDoc && (
          <DocumentCard
            title={signedDoc.number}
            subtitle={`от ${formatRuDateTimeLong(signedDoc.issuedAt)} · ${documentStatusText(signedDoc.status)}`}
            onClick={() => navigate(`/employee/documents/${signedDoc.id}`)}
          />
        )}

        {actionError && <p className={styles.error}>{actionError}</p>}

        {request.status === 'pending' && (
          <Button variant="text" loading={busy} onClick={handleCancel}>
            Отозвать заявку
          </Button>
        )}

        {request.status === 'rejected' && (
          <Button onClick={() => navigate('/employee/new-request')}>Подать новую заявку</Button>
        )}
      </div>
    </div>
  );
}
