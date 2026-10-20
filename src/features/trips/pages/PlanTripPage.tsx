import { useNavigate } from 'react-router-dom';
import { useTrips } from '../../../app/providers/TripsProvider';
import { PageHeader } from '../../../components/ui/PageHeader';
import { TripPlannerForm } from '../components/TripPlannerForm';
import page from './Page.module.css';

export function PlanTripPage() {
  const navigate = useNavigate();
  const { createTrip } = useTrips();
  return <div className={page.page}>
    <PageHeader title="Create a trip" description="Plan the essentials of your journey and how you like to travel." />
    <div className={page.content}><TripPlannerForm onSave={createTrip} onSaved={(saved) => navigate(`/trips/${encodeURIComponent(saved.id)}`)} /></div>
  </div>;
}
