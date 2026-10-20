// Isolated visual QA only. Not imported by the production entry.
import { createRoot } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { appRoutes } from '../src/app/routes';
import { ThemeProvider } from '../src/app/providers/ThemeProvider';
import { TripsProvider } from '../src/app/providers/TripsProvider';
import { LocalStorageTripRepository } from '../src/features/trips/services/LocalStorageTripRepository';
import { transportTrip } from '../src/features/transport/tests/testData';
import { createManualExpense } from '../src/features/budget/domain/model';
import '../src/styles/global.css';

if (!import.meta.env.DEV) throw new Error('QA only');
const now = '2026-10-20T10:00:00.000Z';
const estimate = createManualExpense(transportTrip, { title: 'Airport transfer estimate', amount: 32, category: 'transportation', certainty: 'estimated', date: transportTrip.startDate, note: 'Synthetic QA planning amount' }, 'qa-estimate', now);
const rome = { ...transportTrip, title: 'Rome planning trip', transportSettings: { defaultMode: 'walk' as const, hotelOrigin: true, hotelReturn: true, segmentModes: {} }, budgetLedger: { version: 1 as const, expenses: [estimate] } };
const vienna = { ...transportTrip, id: 'qa-vienna', title: 'Vienna spring break', destination: 'Vienna', startDate: '2027-05-02', endDate: '2027-05-05', itinerary: undefined, selectedStay: undefined, destinationResolution: undefined, transportSettings: undefined, budgetLedger: undefined, createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-10-10T00:00:00.000Z' };
const athens = { ...vienna, id: 'qa-athens', title: 'Athens memories', destination: 'Athens', startDate: '2025-05-02', endDate: '2025-05-05', createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-05-06T00:00:00.000Z' };
const key = 'smart-travel-planner.qa.trips.v1';
const initial = JSON.stringify({ version: 1, trips: [rome, vienna, athens] });
const storage: Storage = {
  get length() { return sessionStorage.getItem(key) ? 1 : 0; },
  key: (index) => index === 0 ? key : null,
  clear: () => sessionStorage.removeItem(key), removeItem: () => sessionStorage.removeItem(key),
  getItem: () => sessionStorage.getItem(key) ?? initial,
  setItem: (_key, value) => sessionStorage.setItem(key, value),
};
const router = createMemoryRouter(appRoutes, { initialEntries: ['/trips'] });
createRoot(document.getElementById('root')!).render(<ThemeProvider><div style={{ position: 'fixed', bottom: 0, right: 0, zIndex: 3000, padding: 8, background: 'var(--surface-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-strong)', fontSize: 11, pointerEvents: 'none' }}>QA ONLY · synthetic trips · isolated sessionStorage</div><TripsProvider repository={new LocalStorageTripRepository(storage)}><RouterProvider router={router} /></TripsProvider></ThemeProvider>);
