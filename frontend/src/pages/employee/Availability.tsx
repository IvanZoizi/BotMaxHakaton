import { useEffect, useState } from 'react';
import { Switch } from '@maxhub/max-ui';
import { ListHeader } from '../../components/Header';
import { Button } from '../../components/Button';
import { BottomNav } from '../../components/BottomNav';
import { SkeletonScreen, ErrorState } from '../../components/States';
import { getMyAvailability, setMyAvailability } from '../../api/client';
import { useAsync } from '../../lib/useAsync';
import type { AvailabilityWindow, Weekday } from '../../api/types';
import styles from './Availability.module.css';

const WEEKDAYS: { key: Weekday; label: string }[] = [
  { key: 'mon', label: 'Понедельник' },
  { key: 'tue', label: 'Вторник' },
  { key: 'wed', label: 'Среда' },
  { key: 'thu', label: 'Четверг' },
  { key: 'fri', label: 'Пятница' },
  { key: 'sat', label: 'Суббота' },
  { key: 'sun', label: 'Воскресенье' },
];

export default function Availability() {
  const { data, loading, error, reload } = useAsync(getMyAvailability, []);
  const [windows, setWindows] = useState<Record<Weekday, AvailabilityWindow>>({} as never);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!data) return;
    const map = {} as Record<Weekday, AvailabilityWindow>;
    WEEKDAYS.forEach(({ key }) => {
      map[key] = data.find((w) => w.weekday === key) ?? {
        weekday: key,
        timeFrom: '09:00',
        timeTo: '21:00',
        openForExtra: false,
      };
    });
    setWindows(map);
  }, [data]);

  const masterOn = Object.values(windows).some((w) => w.openForExtra);

  function toggleDay(day: Weekday, openForExtra: boolean) {
    setWindows((prev) => ({ ...prev, [day]: { ...prev[day], openForExtra } }));
    setSaved(false);
  }

  function updateTime(day: Weekday, field: 'timeFrom' | 'timeTo', value: string) {
    setWindows((prev) => ({ ...prev, [day]: { ...prev[day], [field]: value } }));
    setSaved(false);
  }

  function toggleMaster(on: boolean) {
    setWindows((prev) => {
      const next = { ...prev };
      WEEKDAYS.forEach(({ key }) => {
        next[key] = { ...next[key], openForExtra: on };
      });
      return next;
    });
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await setMyAvailability(Object.values(windows));
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="screen">
      <ListHeader title="Подработка" />
      <div className="screen-content">
        {loading && <SkeletonScreen />}
        {!loading && error && <ErrorState onRetry={reload} />}
        {!loading && !error && (
          <>
            <div className={styles.masterRow}>
              <span className={styles.masterLabel}>Доступен для подработки</span>
              <Switch checked={masterOn} onChange={(e) => toggleMaster(e.target.checked)} />
            </div>

            <div className={styles.days}>
              {WEEKDAYS.map(({ key, label }) => {
                const w = windows[key];
                if (!w) return null;
                return (
                  <div key={key} className={styles.dayRow}>
                    <div className={styles.dayHeader}>
                      <span className={styles.dayLabel}>{label}</span>
                      <Switch checked={w.openForExtra} onChange={(e) => toggleDay(key, e.target.checked)} />
                    </div>
                    {w.openForExtra && (
                      <div className={styles.timeRow}>
                        <input
                          type="time"
                          className={styles.timeInput}
                          value={w.timeFrom}
                          onChange={(e) => updateTime(key, 'timeFrom', e.target.value)}
                        />
                        <span>–</span>
                        <input
                          type="time"
                          className={styles.timeInput}
                          value={w.timeTo}
                          onChange={(e) => updateTime(key, 'timeTo', e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <Button loading={saving} onClick={handleSave}>
              {saved ? 'Сохранено' : 'Сохранить'}
            </Button>
          </>
        )}
      </div>
      <BottomNav role="employee" />
    </div>
  );
}
