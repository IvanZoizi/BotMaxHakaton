import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ListHeader } from '../../components/Header';
import { Button } from '../../components/Button';
import { maxBridge } from '../../bridge/maxBridge';
import { usePersona } from '../../context/AuthContext';
import { linkEmployee } from '../../api/client';
import { ApiError } from '../../api/errors';
import styles from './Connect.module.css';

export default function Connect() {
  const navigate = useNavigate();
  const { setLinked } = usePersona();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function linkWithInviteCode(inviteCode: string) {
    setBusy(true);
    setError(null);
    try {
      await linkEmployee(inviteCode);
      setLinked(true);
      navigate('/employee/home', { replace: true });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось подключиться');
    } finally {
      setBusy(false);
    }
  }

  async function handleScan() {
    const result = await maxBridge.openCodeReader();
    if (!result?.value) return; // отменено или камера недоступна
    // QR кодирует ту же ссылку-приглашение, что бот строит в /add_employee
    // (join_<code> — см. bot/app/routers/employee_admin.py) — либо голый
    // payload, либо полный URL с ним; вытаскиваем код в обоих случаях.
    const match = result.value.match(/join_([\w-]+)/);
    if (!match) {
      setError('QR-код не распознан — не найден код приглашения');
      return;
    }
    await linkWithInviteCode(match[1]);
  }

  return (
    <div className="screen">
      <ListHeader title="Подключение" />
      <div className={styles.content}>
        <p className={styles.lead}>
          Отсканируйте QR-код или перейдите по личной ссылке-приглашению от руководителя — мы найдём
          вас в списке компании.
        </p>
        <div className={styles.qrBox}>QR</div>
        <Button loading={busy} onClick={handleScan}>
          Сканировать QR
        </Button>
        {error && <p className={styles.lead}>{error}</p>}
        <button type="button" className={styles.textLink} onClick={() => navigate('/company/new')}>
          Впервые здесь? Зарегистрировать компанию
        </button>
        <div className={styles.footnote}>После подтверждения — подписать согласие на ЭДО и ПЭП</div>
      </div>
    </div>
  );
}
