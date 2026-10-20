// Explicit synthetic fixture; never imported by the production entry.
import { createRoot } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { appRoutes } from '../src/app/routes';
import { ThemeProvider } from '../src/app/providers/ThemeProvider';
import { TripsProvider } from '../src/app/providers/TripsProvider';
import { LocalStorageTripRepository } from '../src/features/trips/services/LocalStorageTripRepository';
import { transportTrip } from '../src/features/transport/tests/testData';
import '../src/styles/global.css';

if (!import.meta.env.DEV) throw new Error('QA only');
const storageKey = 'smart-travel-planner.qa.assistant.v1';
const other = { ...transportTrip, id: 'assistant-qa-other', title: 'Separate QA trip', itinerary: undefined, selectedStay: undefined };
const initial = JSON.stringify({ version: 1, trips: [transportTrip, other] });
const storage: Storage = {
  get length() { return sessionStorage.getItem(storageKey) ? 1 : 0; },
  key: (index) => index === 0 ? storageKey : null,
  clear: () => sessionStorage.removeItem(storageKey),
  removeItem: () => sessionStorage.removeItem(storageKey),
  getItem: () => sessionStorage.getItem(storageKey) ?? initial,
  setItem: (_key, value) => sessionStorage.setItem(storageKey, value),
};
const router = createMemoryRouter(appRoutes, { initialEntries: [`/trips/${transportTrip.id}/assistant`] });
createRoot(document.getElementById('root')!).render(<ThemeProvider><div style={{ position: 'fixed', bottom: 0, right: 0, zIndex: 3000, padding: 6, background: 'var(--surface-primary)', color: 'var(--text-primary)', fontSize: 11, pointerEvents: 'none' }}>QA ONLY · synthetic data · isolated sessionStorage</div><TripsProvider repository={new LocalStorageTripRepository(storage)}><RouterProvider router={router} /></TripsProvider></ThemeProvider>);
