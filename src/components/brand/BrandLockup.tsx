import { BrandMark } from './BrandMark';
import styles from './BrandLockup.module.css';

type BrandLockupProps = { compact?: boolean };

export function BrandLockup({ compact = false }: BrandLockupProps) {
  return (
    <div className={styles.lockup} aria-label="Smart Travel Planner">
      <BrandMark size={compact ? 32 : 24} />
      {!compact && <span>Smart Travel Planner</span>}
    </div>
  );
}
