import { forwardRef, type ButtonHTMLAttributes } from 'react';
import styles from './Button.module.css';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ variant = 'primary', className = '', ...props }, ref) {
  return <button ref={ref} className={`${styles.button} ${styles[variant]} ${className}`} {...props} />;
});
