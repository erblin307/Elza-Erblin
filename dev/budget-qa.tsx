// Isolated visual QA only. Not imported by the production entry.
import { createRoot } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { appRoutes } from '../src/app/routes';
import { ThemeProvider } from '../src/app/providers/ThemeProvider';
import { TripsProvider } from '../src/app/providers/TripsProvider';
import { LocalStorageTripRepository } from '../src/features/trips/services/LocalStorageTripRepository';
import { createBudgetTrip } from '../src/features/budget/tests/testData';
import '../src/styles/global.css';

if (!import.meta.env.DEV) throw new Error('QA only');
const key = 'smart-travel-planner.qa.budget.v1';
const initial = JSON.stringify({ version: 1, trips: [createBudgetTrip()] });
const storage: Storage = {
  length: 1,
  key: () => key,
  clear: () => sessionStorage.removeItem(key),
  removeItem: () => sessionStorage.removeItem(key),
  getItem: () => sessionStorage.getItem(key) ?? initial,
  setItem: (_key, value) => sessionStorage.setItem(key, value),
};
const router = createMemoryRouter(appRoutes, { initialEntries: ['/trips/test-trip/budget'] });
createRoot(document.getElementById('root')!).render(<ThemeProvider><div style={{ position: 'fixed', bottom: 0, right: 0, zIndex: 3000, padding: 8, background: 'var(--surface-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-strong)', fontSize: 11, pointerEvents: 'none' }}>QA ONLY · synthetic activity estimates · isolated storage</div><TripsProvider repository={new LocalStorageTripRepository(storage)}><RouterProvider router={router} /></TripsProvider></ThemeProvider>);
