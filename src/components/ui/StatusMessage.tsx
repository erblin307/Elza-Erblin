import { AlertCircle } from 'lucide-react';
import styles from './StatusMessage.module.css';

export function StatusMessage({ children }: { children: string }) {
  return <div className={styles.message} role="alert"><AlertCircle size={17} aria-hidden="true" />{children}</div>;
}
