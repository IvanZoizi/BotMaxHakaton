import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Header } from '../../components/Header';
import { Button } from '../../components/Button';
import { CalendarRange } from '../../components/CalendarRange';
import { submitScheduleT7Entry } from '../../api/client';
import { ApiError } from '../../api/errors';
import { formatRange } from '../../lib/date';

/** №24: ответ сотрудника на бот-приглашение /collect_schedule <год>
 * (deeplink t7_<год>) — те же желаемые даты отпуска, но на будущий год, без
 * проверки движком правил (это предпочтение, а не заявка). */
export default function ScheduleT7Submit() {
  const { year = '' } = useParams();
  const navigate = useNavigate();
  const [range, setRange] = useState<{ startDate: string | null; endDate: string | null }>({
    startDate: null,
    endDate: null,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit() {
    if (!range.startDate || !range.endDate) return;
    setBusy(true);
    setError(null);
    try {
      await submitScheduleT7Entry({ year: Number(year), startDate: range.startDate, endDate: range.endDate });
      setDone(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось отправить даты');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="screen">
        <Header title={`График на ${year} год`} />
        <div className="screen-content">
          <p>
            Готово — {range.startDate && range.endDate ? formatRange(range.startDate, range.endDate) : ''} отправлено
            руководителю.
          </p>
          <Button onClick={() => navigate('/employee/home')}>На главную</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      <Header title={`График на ${year} год`} />
      <div className="screen-content">
        <p>Укажите, когда планируете отпуск в {year} году — руководитель соберёт график Т-7.</p>
        <CalendarRange
          startDate={range.startDate}
          endDate={range.endDate}
          onSelect={setRange}
          initialMonth={{ year: Number(year), month: 0 }}
        />
        {error && <p>{error}</p>}
        <Button disabled={!range.startDate || !range.endDate} loading={busy} onClick={handleSubmit}>
          Отправить
        </Button>
      </div>
    </div>
  );
}
