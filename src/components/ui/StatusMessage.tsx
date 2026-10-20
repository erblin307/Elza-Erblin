import { AlertCircle } from 'lucide-react';
import styles from './StatusMessage.module.css';

export function StatusMessage({ children, role = 'alert' }: { children: string; role?: 'alert' | 'status' }) {
  return <div className={styles.message} role={role}><AlertCircle size={17} aria-hidden="true" />{children}</div>;
}
