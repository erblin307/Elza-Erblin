import type { ReactNode } from 'react';
import styles from './PageHeader.module.css';

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return <header className={styles.header}><div><h1>{title}</h1>{description && <p>{description}</p>}</div>{action && <div>{action}</div>}</header>;
}
