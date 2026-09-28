import { useNavigate, useParams } from 'react-router-dom';
import { Header } from '../../components/Header';
import { Button } from '../../components/Button';
import { SkeletonScreen, ErrorState } from '../../components/States';
import { acceptShiftOffer, declineShiftOffer, getShiftOffer } from '../../api/mockApi';
import { useAsync } from '../../lib/useAsync';
import styles from './ShiftOfferScreen.module.css';

export default function ShiftOfferScreen() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data: offer, loading, error, reload } = useAsync(() => getShiftOffer(id), [id]);

  if (loading) {
    return (
      <div className="screen">
        <Header title="Предложение подработки" />
        <SkeletonScreen />
      </div>
    );
  }

  if (error || !offer) {
    return (
      <div className="screen">
        <Header title="Предложение подработки" />
        <ErrorState onRetry={reload} />
      </div>
    );
  }

  const resolved = offer.status !== 'proposed';

  return (
    <div className="screen">
      <Header title="Предложение подработки" />
      <div className="screen-content">
        <div className={styles.card}>
          <p className={styles.title}>{offer.shiftLabel}</p>
          <p className={styles.meta}>Сегодня, 9:00–21:00</p>
          <p className={styles.pay}>Доплата за подработку: {offer.payBonus}</p>
        </div>

        {resolved ? (
          <p className={offer.status === 'accepted' ? styles.resultOk : styles.resultBad}>
            {offer.status === 'accepted' ? '✓ Вы приняли смену' : 'Вы отклонили предложение'}
          </p>
        ) : (
          <>
            <Button
              variant="text"
              onClick={async () => {
                await declineShiftOffer(id);
                reload();
              }}
            >
              Не смогу
            </Button>
            <Button
              onClick={async () => {
                await acceptShiftOffer(id);
                reload();
              }}
            >
              Выйду
            </Button>
          </>
        )}

        <Button variant="text" onClick={() => navigate('/employee/home')}>
          На главную
        </Button>
      </div>
    </div>
  );
}
