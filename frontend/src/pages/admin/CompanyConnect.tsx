import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { StepHeader } from '../../components/Header';
import { Button } from '../../components/Button';
import { getCompanySummary } from '../../api/client';
import { useAsync } from '../../lib/useAsync';
import styles from './CompanyConnect.module.css';

export default function CompanyConnect() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [company, setCompany] = useState({ name: 'ООО «Ромашка»', inn: '7712345678', timezone: 'МСК (UTC+3)' });
  const [invite, setInvite] = useState({ location: '«Баумана, 12»', manager: 'Петрова М. А. · +7 900 ...' });
  const summary = useAsync(getCompanySummary, [step === 4]);

  if (step === 1) {
    return (
      <div className="screen">
        <StepHeader eyebrow="Подключение компании · шаг 1 из 3" title="Данные компании" />
        <div className="screen-content">
          <Field label="Название компании" value={company.name} onChange={(v) => setCompany({ ...company, name: v })} />
          <Field label="ИНН" value={company.inn} onChange={(v) => setCompany({ ...company, inn: v })} />
          <Field label="Часовой пояс" value={company.timezone} onChange={(v) => setCompany({ ...company, timezone: v })} />
          <Button onClick={() => setStep(2)}>Продолжить</Button>
        </div>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="screen">
        <StepHeader eyebrow="Подключение компании · шаг 2 из 3" title="Пригласите руководителей" />
        <div className="screen-content">
          <p className={styles.lead}>
            Отправьте ссылку-приглашение руководителям подразделений — они смогут согласовывать заявки
            своей команды.
          </p>
          <Field label="Подразделение" value={invite.location} onChange={(v) => setInvite({ ...invite, location: v })} />
          <Field label="Руководитель" value={invite.manager} onChange={(v) => setInvite({ ...invite, manager: v })} />
          <Button onClick={() => setStep(3)}>Отправить приглашение</Button>
        </div>
      </div>
    );
  }

  if (step === 3) {
    return (
      <div className="screen">
        <StepHeader eyebrow="Подключение компании · шаг 3 из 3" title="Пригласите сотрудников" />
        <div className="screen-content">
          <div className={styles.qrBox}>QR</div>
          <p className={styles.lead}>
            Покажите QR-код на общем экране или разошлите ссылку-приглашение — сотрудники подключатся
            через MAX самостоятельно.
          </p>
          <Button onClick={() => setStep(4)}>Готово</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      <div className="screen-content">
        <div className={styles.doneBox}>
          <p className={styles.doneIcon}>✓</p>
          <p className={styles.doneTitle}>Компания подключена</p>
        </div>
        {summary.data && (
          <div className={styles.progress}>
            <p>
              {summary.data.locations} подразделение · {summary.data.managersInvited} руководитель приглашён
            </p>
            <p>
              {summary.data.employeesConnected} сотрудников подключено из {summary.data.employeesInvited}{' '}
              приглашённых
            </p>
          </div>
        )}
        <Button onClick={() => navigate('/admin/employees')}>Перейти к сотрудникам</Button>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <input className={styles.input} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
