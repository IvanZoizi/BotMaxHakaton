import { useNavigate } from 'react-router-dom';
import { ListHeader } from '../../components/Header';
import { Button } from '../../components/Button';
import { maxBridge } from '../../bridge/maxBridge';
import { usePersona } from '../../context/AuthContext';
import styles from './Connect.module.css';

export default function Connect() {
  const navigate = useNavigate();
  const { setLinked } = usePersona();

  async function handleScan() {
    await maxBridge.openCodeReader();
    setLinked(true);
    navigate('/employee/home', { replace: true });
  }

  async function handleShareContact() {
    await maxBridge.requestContact();
    setLinked(true);
    navigate('/employee/home', { replace: true });
  }

  return (
    <div className="screen">
      <ListHeader title="Подключение" />
      <div className={styles.content}>
        <p className={styles.lead}>
          Отсканируйте QR-код в мессенджере MAX или поделитесь номером телефона — мы найдём вас в
          списке компании.
        </p>
        <div className={styles.qrBox}>QR</div>
        <Button onClick={handleScan}>Сканировать QR</Button>
        <button type="button" className={styles.textLink} onClick={handleShareContact}>
          Поделиться номером
        </button>
        <div className={styles.footnote}>После подтверждения — подписать согласие на ЭДО и ПЭП</div>
      </div>
    </div>
  );
}
