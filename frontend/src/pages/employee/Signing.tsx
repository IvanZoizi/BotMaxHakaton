import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Header } from '../../components/Header';
import { Button } from '../../components/Button';
import { SignatureStamp } from '../../components/DocumentCard';
import { BottomSheet, SheetTitle, SheetText } from '../../components/BottomSheet';
import { SkeletonScreen, ErrorState } from '../../components/States';
import { getDocument, signDocument } from '../../api/client';
import { useAsync } from '../../lib/useAsync';
import { maxBridge } from '../../bridge/maxBridge';
import { formatDateTime } from '../../lib/date';
import styles from './Signing.module.css';

// 'cancelled' matches the full-screen "Biometric Cancelled" state from
// Figma page 07 — States. The biometric-unavailable case, by contrast, is
// BottomSheet/Confirm in page 02 — Components, so it's a sheet over 'idle'
// (via confirmSheetOpen below), not its own screen.
type Step = 'idle' | 'biometric' | 'success' | 'cancelled';

const KIND_DESCRIPTION: Record<string, string> = {
  application: 'Заявление формируется на основании выбранных вами дат отпуска',
  notice: 'Уведомление формируется на основании согласованной заявки на отпуск',
  order_t6: 'Приказ формируется на основании согласованной заявки на отпуск',
  schedule_t7: 'График формируется на основании графика отпусков компании',
};

export default function Signing() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('idle');
  const [confirmSheetOpen, setConfirmSheetOpen] = useState(false);
  const { data: doc, loading, error, reload } = useAsync(() => getDocument(id), [id]);

  if (loading) {
    return (
      <div className="screen">
        <Header title="Подписание документа" />
        <SkeletonScreen />
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className="screen">
        <Header title="Подписание документа" />
        <ErrorState onRetry={reload} />
      </div>
    );
  }

  async function startSigning() {
    if (!maxBridge.isNative()) {
      setConfirmSheetOpen(true);
      return;
    }
    setStep('biometric');
    const result = await maxBridge.biometric.authenticate();
    if (result.status === 'success') {
      await signDocument(id, 'biometric');
      maxBridge.haptics.impact('medium');
      setStep('success');
    } else if (result.status === 'cancelled') {
      setStep('cancelled');
    } else {
      setStep('idle');
      setConfirmSheetOpen(true);
    }
  }

  async function confirmWithoutBiometric() {
    setConfirmSheetOpen(false);
    await signDocument(id, 'confirm');
    setStep('success');
  }

  const pendingSigner = doc.signers.find((s) => !s.signedAt);
  const alreadySigned = doc.signers.filter((s) => s.signedAt);

  if (step === 'biometric') {
    return (
      <div className="screen">
        <Header title="Подписание документа" />
        <div className={styles.biometricBox}>
          <div className={styles.pulse} />
          <p className={styles.biometricTitle}>Подтвердите личность биометрией MAX</p>
          <p className={styles.biometricHint}>Не закрывайте приложение</p>
        </div>
      </div>
    );
  }

  if (step === 'success') {
    return (
      <div className="screen">
        <Header title="Подписание документа" />
        <div className="screen-content">
          <div className={styles.successBox}>
            <p className={styles.successIcon}>✓</p>
            <p className={styles.successTitle}>Документ подписан</p>
          </div>
          {alreadySigned[alreadySigned.length - 1] && (
            <SignatureStamp
              signerName={alreadySigned[alreadySigned.length - 1].fullName}
              signedAt={formatDateTime(alreadySigned[alreadySigned.length - 1].signedAt!)}
              method={alreadySigned[alreadySigned.length - 1].method ?? 'confirm'}
              code={alreadySigned[alreadySigned.length - 1].employeeId.slice(-6)}
            />
          )}
          <Button onClick={() => navigate(-1)}>Готово</Button>
        </div>
      </div>
    );
  }

  if (step === 'cancelled') {
    return (
      <div className="screen">
        <Header title="Подписание документа" />
        <div className="screen-content">
          <div className={styles.cancelledBox}>
            <p className={styles.cancelledIcon}>✕</p>
            <p className={styles.cancelledTitle}>Биометрия отменена</p>
            <p className={styles.cancelledHint}>Документ не подписан. Вы можете попробовать снова.</p>
          </div>
          <Button variant="text" onClick={() => navigate(-1)}>
            Отменить
          </Button>
          <Button onClick={() => setStep('idle')}>Попробовать снова</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      <Header title="Подписание документа" />
      <div className="screen-content">
        <p className={styles.docTitle}>{doc.number}</p>
        <p className={styles.docSubtitle}>
          {KIND_DESCRIPTION[doc.kind] ?? 'Документ формируется на основании согласованной заявки на отпуск'}
        </p>
        <div className={styles.pdfPreview}>PDF preview</div>
        {pendingSigner && (
          <p className={styles.pending}>
            Кто ещё должен подписать: {alreadySigned.map((s) => s.fullName).join(', ') || '—'}
          </p>
        )}
        <div className={styles.warning}>
          Подписывая документ, вы подтверждаете согласие с его содержанием. Отменить подпись после
          отправки будет нельзя.
        </div>
        <Button onClick={startSigning}>Подписать</Button>
      </div>

      <BottomSheet open={confirmSheetOpen} onClose={() => setConfirmSheetOpen(false)}>
        <SheetTitle>Подтвердите подпись</SheetTitle>
        <SheetText>Биометрия недоступна в этой версии MAX. Подтвердите, что документ подписываете вы.</SheetText>
        <Button onClick={confirmWithoutBiometric}>Подтверждаю</Button>
      </BottomSheet>
    </div>
  );
}
