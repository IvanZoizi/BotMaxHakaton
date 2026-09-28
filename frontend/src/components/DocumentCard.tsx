import styles from './DocumentCard.module.css';

interface DocumentCardProps {
  title: string;
  subtitle: string;
  onClick?: () => void;
}

export function DocumentCard({ title, subtitle, onClick }: DocumentCardProps) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag className={styles.card} onClick={onClick} type={onClick ? 'button' : undefined}>
      <div className={styles.icon}>PDF</div>
      <div className={styles.info}>
        <p className={styles.title}>{title}</p>
        <p className={styles.subtitle}>{subtitle}</p>
      </div>
    </Tag>
  );
}

interface SignatureStampProps {
  signerName: string;
  signedAt: string;
  method: 'biometric' | 'confirm';
  code: string;
}

export function SignatureStamp({ signerName, signedAt, method, code }: SignatureStampProps) {
  const methodLabel = method === 'biometric' ? 'биометрия' : 'подтверждение в приложении';
  return (
    <div className={styles.stamp}>
      <p className={styles.stampTitle}>✓ Подписано ПЭП</p>
      <p className={styles.stampMeta}>
        {signerName} · {signedAt} МСК · {methodLabel} · код {code}
      </p>
    </div>
  );
}
