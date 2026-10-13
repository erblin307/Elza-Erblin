import { Route, Routes } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { HomePage } from '../features/trips/pages/HomePage';
import { TripsPage } from '../features/trips/pages/TripsPage';
import { PlanTripPage } from '../features/trips/pages/PlanTripPage';
import { TripOverviewPage } from '../features/trips/pages/TripOverviewPage';
import { NotFoundPage } from '../features/trips/pages/NotFoundPage';

export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<HomePage />} />
        <Route path="trips" element={<TripsPage />} />
        <Route path="plan" element={<PlanTripPage />} />
        <Route path="trips/:tripId" element={<TripOverviewPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
