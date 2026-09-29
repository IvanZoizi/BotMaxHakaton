import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { StepHeader } from '../../components/Header';
import { Button } from '../../components/Button';
import { usePersona } from '../../context/AuthContext';
import { createCompany, createEmployee, createLocation, getCompanySummary } from '../../api/client';
import { ApiError } from '../../api/errors';
import { useAsync } from '../../lib/useAsync';
import styles from './CompanyConnect.module.css';

export default function CompanyConnect() {
  const navigate = useNavigate();
  const { setLinked, setRole } = usePersona();
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [company, setCompany] = useState({ name: 'ООО «Ромашка»', locationName: '«Баумана, 12»', adminFullName: '' });
  const [managerLocationId, setManagerLocationId] = useState<string | null>(null);
  const [invite, setInvite] = useState({ location: '«Баумана, 12»', managerName: '', managerPosition: 'Управляющий точкой' });
  const [managerInviteCode, setManagerInviteCode] = useState<string | null>(null);

  const [employeeName, setEmployeeName] = useState('');
  const [addedEmployees, setAddedEmployees] = useState<{ fullName: string; inviteCode: string }[]>([]);

  const summary = useAsync(getCompanySummary, [step === 4]);

  async function handleCreateCompany() {
    if (!company.adminFullName.trim()) {
      setError('Укажите своё имя');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const me = await createCompany({
        name: company.name,
        locationName: company.locationName,
        adminFullName: company.adminFullName,
      });
      setLinked(true);
      setRole('admin');
      setManagerLocationId(me.locationId ?? null);
      setStep(2);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось зарегистрировать компанию');
    } finally {
      setBusy(false);
    }
  }

  async function handleInviteManager() {
    if (!invite.managerName.trim()) {
      setError('Укажите ФИО руководителя');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const location = await createLocation({ name: invite.location });
      const created = await createEmployee({
        fullName: invite.managerName,
        position: invite.managerPosition,
        role: 'manager',
        locationId: location.id,
      });
      setManagerLocationId(location.id);
      setManagerInviteCode(created.inviteCode);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось создать приглашение');
    } finally {
      setBusy(false);
    }
  }

  async function handleAddEmployee() {
    if (!employeeName.trim() || !managerLocationId) return;
    setBusy(true);
    setError(null);
    try {
      const created = await createEmployee({
        fullName: employeeName,
        position: 'Сотрудник',
        role: 'employee',
        locationId: managerLocationId,
      });
      setAddedEmployees((prev) => [...prev, { fullName: employeeName, inviteCode: created.inviteCode }]);
      setEmployeeName('');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось добавить сотрудника');
    } finally {
      setBusy(false);
    }
  }

  if (step === 1) {
    return (
      <div className="screen">
        <StepHeader eyebrow="Подключение компании · шаг 1 из 3" title="Данные компании" />
        <div className="screen-content">
          <Field label="Название компании" value={company.name} onChange={(v) => setCompany({ ...company, name: v })} />
          <Field
            label="Название точки"
            value={company.locationName}
            onChange={(v) => setCompany({ ...company, locationName: v })}
          />
          <Field
            label="Ваше имя"
            value={company.adminFullName}
            onChange={(v) => setCompany({ ...company, adminFullName: v })}
          />
          {error && <p className={styles.lead}>{error}</p>}
          <Button loading={busy} onClick={handleCreateCompany}>
            Продолжить
          </Button>
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
            Укажите подразделение и руководителя — получите персональную ссылку-приглашение, она
            одноразовая.
          </p>
          <Field label="Подразделение" value={invite.location} onChange={(v) => setInvite({ ...invite, location: v })} />
          <Field
            label="ФИО руководителя"
            value={invite.managerName}
            onChange={(v) => setInvite({ ...invite, managerName: v })}
          />
          <Field
            label="Должность"
            value={invite.managerPosition}
            onChange={(v) => setInvite({ ...invite, managerPosition: v })}
          />
          {error && <p className={styles.lead}>{error}</p>}
          {managerInviteCode ? (
            <>
              <p className={styles.lead}>Код приглашения: {managerInviteCode}</p>
              <Button onClick={() => setStep(3)}>Продолжить</Button>
            </>
          ) : (
            <Button loading={busy} onClick={handleInviteManager}>
              Отправить приглашение
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (step === 3) {
    return (
      <div className="screen">
        <StepHeader eyebrow="Подключение компании · шаг 3 из 3" title="Пригласите сотрудников" />
        <div className="screen-content">
          <p className={styles.lead}>
            Добавьте сотрудника по имени — получите его личный код приглашения. Повторите для
            каждого.
          </p>
          <Field label="ФИО сотрудника" value={employeeName} onChange={setEmployeeName} />
          {error && <p className={styles.lead}>{error}</p>}
          <Button loading={busy} onClick={handleAddEmployee}>
            Добавить и получить код
          </Button>
          {addedEmployees.map((e) => (
            <p key={e.inviteCode} className={styles.lead}>
              {e.fullName}: {e.inviteCode}
            </p>
          ))}
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
