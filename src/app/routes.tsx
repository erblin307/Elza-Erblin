import { createRoutesFromElements, Route } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { HomePage } from '../features/trips/pages/HomePage';
import { TripsPage } from '../features/trips/pages/TripsPage';
import { PlanTripPage } from '../features/trips/pages/PlanTripPage';
import { TripOverviewPage } from '../features/trips/pages/TripOverviewPage';
import { NotFoundPage } from '../features/trips/pages/NotFoundPage';
import { TripWorkspaceLayout } from '../features/trips/components/TripWorkspaceLayout';
import { EditTripPage } from '../features/trips/pages/EditTripPage';
import { ItineraryPage } from '../features/itinerary/pages/ItineraryPage';
import { lazy, Suspense } from 'react';
const TripMapPage = lazy(() => import('../features/map/pages/TripMapPage').then((module) => ({ default: module.TripMapPage })));
const PlacesPage = lazy(() => import('../features/places/pages/PlacesPage').then((module) => ({ default: module.PlacesPage })));
const AccommodationPage = lazy(() => import('../features/accommodation/pages/AccommodationPage').then((module) => ({ default: module.AccommodationPage })));
const TransportPage = lazy(() => import('../features/transport/pages/TransportPage').then((module) => ({ default: module.TransportPage })));
const BudgetPage = lazy(() => import('../features/budget/pages/BudgetPage').then((module) => ({ default: module.BudgetPage })));
const LongDistanceTransportPage = lazy(() => import('../features/long-distance-transport/pages/LongDistanceTransportPage').then((module) => ({ default: module.LongDistanceTransportPage })));
const AssistantPage = lazy(() => import('../features/assistant/pages/AssistantPage').then((module) => ({ default: module.AssistantPage })));

export const appRoutes = createRoutesFromElements(
  <Route element={<AppShell />}>
    <Route index element={<HomePage />} />
    <Route path="trips" element={<TripsPage />} />
    <Route path="plan" element={<PlanTripPage />} />
    <Route path="trips/:tripId" element={<TripWorkspaceLayout />}>
      <Route index element={<TripOverviewPage />} />
      <Route path="edit" element={<EditTripPage />} />
      <Route path="itinerary" element={<ItineraryPage />} />
      <Route path="map" element={<Suspense fallback={<p role="status">Loading map workspace…</p>}><TripMapPage /></Suspense>} />
      <Route path="places" element={<Suspense fallback={<p role="status">Loading places workspace…</p>}><PlacesPage /></Suspense>} />
      <Route path="accommodation" element={<Suspense fallback={<p role="status">Loading accommodation workspace…</p>}><AccommodationPage /></Suspense>} />
      <Route path="transport" element={<Suspense fallback={<p role="status">Loading transportation workspace…</p>}><TransportPage /></Suspense>} />
      <Route path="travel" element={<Suspense fallback={<p role="status">Loading travel workspace…</p>}><LongDistanceTransportPage /></Suspense>} />
      <Route path="budget" element={<Suspense fallback={<p role="status">Loading budget workspace…</p>}><BudgetPage /></Suspense>} />
      <Route path="assistant" element={<Suspense fallback={<p role="status">Loading assistant…</p>}><AssistantPage /></Suspense>} />
    </Route>
    <Route path="*" element={<NotFoundPage />} />
  </Route>,
);
