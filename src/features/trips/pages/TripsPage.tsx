import { ArrowRight, CalendarDays, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTrips } from '../../../app/providers/TripsProvider';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { PageHeader } from '../../../components/ui/PageHeader';
import { StatusMessage } from '../../../components/ui/StatusMessage';
import type { Trip } from '../types/trip';
import { formatBudget, formatDateRange, tripStatus } from '../utils/tripFormatters';
import page from './Page.module.css';
import styles from './TripsPage.module.css';

export function TripsPage() {
  const { trips, isLoading, error, deleteTrip } = useTrips();
  const [tripToDelete, setTripToDelete] = useState<Trip | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!tripToDelete) return;
    setDeleting(true);
    try { await deleteTrip(tripToDelete.id); setTripToDelete(null); } finally { setDeleting(false); }
  };

  return (
    <div className={page.page}>
      <PageHeader title="My Trips" description="All the journeys you have saved in this browser." action={<Link to="/plan" className={page.buttonLink}><Plus size={16} /> New trip</Link>} />
      {error && <div className={styles.alert}><StatusMessage>{error}</StatusMessage></div>}
      {isLoading ? <p className={page.loading}>Loading your trips…</p> : trips.length === 0 ? (
        <section className={page.empty}>
          <div className={page.emptyInner}>
            <div className={page.emptyIcon}><CalendarDays size={25} strokeWidth={1.7} aria-hidden="true" /></div>
            <h2>No trips yet</h2>
            <p>Create your first trip to keep the route, dates, travelers and budget together.</p>
            <Link to="/plan" className={page.buttonLink}>Create a trip <ArrowRight size={16} /></Link>
          </div>
        </section>
      ) : (
        <section className={`${page.content} ${styles.library}`} aria-label="Saved trips">
          <div className={styles.listHeader}><span>Trip</span><span>Dates</span><span>Travelers</span><span>Budget</span><span className="sr-only">Actions</span></div>
          <div className={styles.list}>
            {trips.map((trip) => (
              <article className={styles.row} key={trip.id}>
                <Link className={styles.mainLink} to={`/trips/${trip.id}`} aria-label={`Open ${trip.title}`} />
                <div className={styles.tripCell}><span className={styles.dot} aria-hidden="true" /><div><h2>{trip.title}</h2><p>{trip.origin} → {trip.destination}</p></div></div>
                <div className={styles.metaCell} data-label="Dates"><span className={styles.mobileLabel}>Dates</span>{formatDateRange(trip.startDate, trip.endDate)}<small>{tripStatus(trip)}</small></div>
                <div className={styles.metaCell} data-label="Travelers"><span className={styles.mobileLabel}>Travelers</span>{trip.travelers}</div>
                <div className={styles.metaCell} data-label="Budget"><span className={styles.mobileLabel}>Budget</span>{formatBudget(trip)}</div>
                <button className={styles.deleteButton} type="button" aria-label={`Delete ${trip.title}`} title="Delete trip" onClick={() => setTripToDelete(trip)}><Trash2 size={17} /></button>
              </article>
            ))}
          </div>
        </section>
      )}
      <ConfirmDialog open={Boolean(tripToDelete)} title="Delete this trip?" description={tripToDelete ? `${tripToDelete.title} will be removed from this browser. This cannot be undone.` : ''} confirmLabel="Delete trip" busy={deleting} onConfirm={() => void handleDelete()} onCancel={() => setTripToDelete(null)} />
    </div>
  );
}
