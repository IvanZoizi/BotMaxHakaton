import { Header } from '../../components/Header';
import { SkeletonScreen, ErrorState } from '../../components/States';
import { listRules } from '../../api/mockApi';
import { useAsync } from '../../lib/useAsync';
import { isoDate } from '../../lib/date';
import styles from './SettingsRules.module.css';

const TYPE_LABEL: Record<string, string> = {
  law: 'Закон',
  calculation: 'Расчёт',
  company: 'Правило компании',
};

export default function SettingsRules() {
  const { data: rules, loading, error, reload } = useAsync(listRules, []);

  return (
    <div className="screen">
      <Header title="Основания и нормы" />
      <div className="screen-content">
        {loading && <SkeletonScreen />}
        {!loading && error && <ErrorState onRetry={reload} />}
        {!loading &&
          !error &&
          rules?.map((rule) => (
            <div key={rule.id} className={styles.card}>
              <div className={styles.head}>
                <p className={styles.norm}>{rule.norm.title}</p>
                <span className={styles.tag}>{TYPE_LABEL[rule.type]}</span>
              </div>
              <p className={styles.message}>{rule.messages.pass}</p>
              <p className={styles.meta}>
                Действует с {isoDate(rule.effectiveFrom)} · сверено {isoDate(rule.checkedAt)}
              </p>
            </div>
          ))}
      </div>
    </div>
  );
}
