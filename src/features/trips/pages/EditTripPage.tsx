import { useNavigate } from 'react-router-dom';
import { useRef } from 'react';
import { useTrips } from '../../../app/providers/TripsProvider';
import { TripPlannerForm } from '../components/TripPlannerForm';
import { useWorkspaceTrip } from '../components/TripWorkspaceLayout';

export function EditTripPage() {
  const trip = useWorkspaceTrip();
  const { updateTrip } = useTrips();
  const navigate = useNavigate();
  const startedAt = useRef(trip.updatedAt);
  return <TripPlannerForm key={trip.id} trip={trip} onSave={(input) => updateTrip(trip.id, input, startedAt.current)} onSaved={(saved) => navigate(`/trips/${encodeURIComponent(saved.id)}`)} />;
}
