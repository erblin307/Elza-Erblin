// Isolated visual QA only. Not imported by the production entry.
import { createRoot } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { appRoutes } from '../src/app/routes';
import { ThemeProvider } from '../src/app/providers/ThemeProvider';
import { TripsProvider } from '../src/app/providers/TripsProvider';
import { LocalStorageTripRepository } from '../src/features/trips/services/LocalStorageTripRepository';
import { createManualJourney } from '../src/features/long-distance-transport/domain/model';
import { generateItinerary } from '../src/features/itinerary/domain/generator';
import { candidatePool, generationOptions, testTrip } from '../src/features/itinerary/tests/testData';
import '../src/styles/global.css';

if (!import.meta.env.DEV) throw new Error('QA only');
const outbound = createManualJourney(testTrip, { direction: 'outbound', mode: 'flight', departureLocation: 'Prishtina International Airport (PRN)', arrivalLocation: 'Rome Fiumicino Airport (FCO)', departureLocalDateTime: '2027-06-12T08:00', arrivalLocalDateTime: '2027-06-12T10:05', departureUtcOffset: '+02:00', arrivalUtcOffset: '+02:00', operator: 'Synthetic QA Air', serviceNumber: 'QA 101', bookingReference: 'QA-LOCAL-ONLY', estimatedCost: 428.5, currency: 'EUR', notes: 'Synthetic manual journey for visual QA only.' }, 'qa-outbound', '2026-10-20T10:00:00.000Z');
const returning = createManualJourney(testTrip, { direction: 'return', mode: 'train', departureLocation: 'Roma Termini', arrivalLocation: 'Prishtina Central Station', departureLocalDateTime: '2027-06-14T09:30', arrivalLocalDateTime: '2027-06-14T18:45', departureUtcOffset: '+02:00', arrivalUtcOffset: '+02:00', operator: 'Synthetic QA Rail', serviceNumber: 'QA 42', estimatedCost: 89, currency: 'EUR' }, 'qa-return', '2026-10-20T10:00:00.000Z');
const travelTrip = { ...testTrip, title: 'Rome summer study', longDistanceTravel: { version: 1 as const, journeys: [outbound, returning] } };
const trip = { ...travelTrip, itinerary: generateItinerary(travelTrip, candidatePool(), generationOptions) };
const storageKey = 'smart-travel-planner.qa.travel.v2';
const initial = JSON.stringify({ version: 1, trips: [trip] });
const storage: Storage = {
  get length() { return sessionStorage.getItem(storageKey) ? 1 : 0; },
  key: (index) => index === 0 ? storageKey : null,
  clear: () => sessionStorage.removeItem(storageKey),
  removeItem: () => sessionStorage.removeItem(storageKey),
  getItem: () => sessionStorage.getItem(storageKey) ?? initial,
  setItem: (_key, value) => sessionStorage.setItem(storageKey, value),
};
const router = createMemoryRouter(appRoutes, { initialEntries: [`/trips/${trip.id}/travel`] });
createRoot(document.getElementById('root')!).render(<ThemeProvider><div style={{ position: 'fixed', bottom: 0, right: 0, zIndex: 3000, padding: 8, background: 'var(--surface-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-strong)', fontSize: 11, pointerEvents: 'none' }}>QA ONLY · synthetic manual travel · isolated sessionStorage</div><TripsProvider repository={new LocalStorageTripRepository(storage)}><RouterProvider router={router} /></TripsProvider></ThemeProvider>);
