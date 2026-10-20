import { useEffect, useRef } from 'react';
import { Button } from './Button';
import styles from './ConfirmDialog.module.css';

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  busy?: boolean;
  busyLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'primary' | 'danger';
};

export function ConfirmDialog({ open, title, description, confirmLabel, busy = false, busyLabel = 'Working…', onConfirm, onCancel, variant = 'danger' }: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog ref={dialogRef} className={styles.dialog} aria-labelledby="confirmation-title" aria-describedby="confirmation-description" onCancel={(event) => { event.preventDefault(); if (!busy) onCancel(); }} onClose={() => { if (open && !busy) onCancel(); }}>
      <h2 id="confirmation-title">{title}</h2>
      <p id="confirmation-description">{description}</p>
      <div className={styles.actions}>
        <Button variant="secondary" onClick={onCancel} disabled={busy}>Cancel</Button>
        <Button variant={variant} onClick={onConfirm} disabled={busy}>{busy ? busyLabel : confirmLabel}</Button>
      </div>
    </dialog>
  );
}
