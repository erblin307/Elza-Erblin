import type { ReactNode } from 'react';
import { ThemeProvider } from './ThemeProvider';
import { TripsProvider } from './TripsProvider';

export function AppProviders({ children }: { children: ReactNode }) {
  return <ThemeProvider><TripsProvider>{children}</TripsProvider></ThemeProvider>;
}
