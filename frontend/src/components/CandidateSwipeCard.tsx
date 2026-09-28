import type { ShiftCandidate, ShiftOfferStatus } from '../api/types';
import { Avatar } from './EmployeeRow';
import styles from './CandidateSwipeCard.module.css';

interface CandidateSwipeCardProps {
  candidate: ShiftCandidate;
  offerStatus?: ShiftOfferStatus;
  onSkip?: () => void;
  onOffer?: () => void;
}

export function CandidateSwipeCard({ candidate, offerStatus, onSkip, onOffer }: CandidateSwipeCardProps) {
  const resolved = offerStatus === 'accepted' || offerStatus === 'declined';

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <Avatar fullName={candidate.fullName} size={40} />
        <div className={styles.headerText}>
          <p className={styles.name}>{candidate.fullName}</p>
          <p className={styles.position}>{candidate.position}</p>
        </div>
      </div>
      <div className={styles.reasons}>
        {candidate.reasons.map((reason, i) => (
          <p key={i} className={styles.reasonLine}>
            {reason}
          </p>
        ))}
      </div>
      {resolved ? (
        <div className={offerStatus === 'accepted' ? styles.resultOk : styles.resultBad}>
          {offerStatus === 'accepted' ? '✓ Принял смену' : '✕ Отклонил предложение'}
        </div>
      ) : (
        <div className={styles.actions}>
          <button type="button" className={styles.skip} onClick={onSkip}>
            Пропустить
          </button>
          <button type="button" className={styles.offer} onClick={onOffer}>
            Предложить смену
          </button>
        </div>
      )}
    </div>
  );
}
