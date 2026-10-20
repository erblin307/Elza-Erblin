import { useEffect, useState } from 'react';
import { Link, Outlet, useOutletContext, useParams } from 'react-router-dom';
import { useTrips } from '../../../app/providers/TripsProvider';
import { Button } from '../../../components/ui/Button';
import { StatusMessage } from '../../../components/ui/StatusMessage';
import type { Trip } from '../types/trip';
import { isValidTripId } from '../validation/tripId';
import { TripContextSidebar } from './TripContextSidebar';
import { TripWorkspaceHeader } from './TripWorkspaceHeader';
import styles from './TripWorkspace.module.css';
import { TransportProvider } from '../../transport/components/TransportProvider';

type LoadState = { id: string; attempt: number; error?: string };

export function TripWorkspaceLayout() {
  const { tripId } = useParams();
  const { trips, isLoading, loadTrip } = useTrips();
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState<LoadState | null>(null);
  const validId = isValidTripId(tripId);

  useEffect(() => {
    if (!validId || isLoading) return;
    let active = true;
    loadTrip(tripId).then(
      () => { if (active) setLoaded({ id: tripId, attempt }); },
      (cause: unknown) => {
        if (active) setLoaded({ id: tripId, attempt, error: cause instanceof Error ? cause.message : 'This trip could not be loaded. Please try again.' });
      },
    );
    return () => { active = false; };
  }, [tripId, validId, isLoading, attempt, loadTrip]);

  const pending = validId && (isLoading || loaded?.id !== tripId || loaded.attempt !== attempt);
  const trip = trips.find((item) => item.id === tripId);
  if (pending) return <div className={styles.state} role="status" aria-live="polite" aria-busy="true"><h1>Opening your trip</h1><p>Loading your saved trip details…</p></div>;
  if (validId && loaded?.error) return <div className={styles.state}><h1>Unable to open this trip</h1><StatusMessage>{loaded.error}</StatusMessage><div className={styles.stateActions}><Button onClick={() => setAttempt((current) => current + 1)}>Try again</Button><Link to="/trips">Back to My Trips</Link></div></div>;
  if (!validId || !trip) return <div className={styles.state}><h1>Trip not found</h1><p>This trip may have been deleted or the link may be incorrect.</p><Link className={styles.primaryLink} to="/trips">Back to My Trips</Link></div>;

  return <TransportProvider key={trip.id} trip={trip}><div className={styles.workspace}>
    <TripContextSidebar key={trip.id} trip={trip} />
    <div className={styles.workspaceMain}>
      <TripWorkspaceHeader trip={trip} />
      <div className={styles.content}><Outlet context={trip} /></div>
    </div>
  </div></TransportProvider>;
}

export function useWorkspaceTrip() {
  return useOutletContext<Trip>();
}
