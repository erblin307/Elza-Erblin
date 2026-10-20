import { ArrowRight, CalendarDays, Copy, Download, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTrips } from '../../../app/providers/TripsProvider';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { PageHeader } from '../../../components/ui/PageHeader';
import { StatusMessage } from '../../../components/ui/StatusMessage';
import { tripFilterLabels, tripFilters, tripSortLabels, tripSorts, visibleTrips, type TripFilter, type TripSort } from '../domain/tripLibrary';
import type { Trip } from '../types/trip';
import { formatBudget, formatDateRange, tripStatus } from '../utils/tripFormatters';
import page from './Page.module.css';
import styles from './TripsPage.module.css';

function downloadBackup(contents: string) {
  const url = URL.createObjectURL(new Blob([contents], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url; link.download = `smart-travel-planner-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click(); URL.revokeObjectURL(url);
}

export function TripsPage() {
  const { trips, isLoading, error, readWarning, syncNotice, duplicateTrip, deleteTrip, exportTrips } = useTrips();
  const [tripToDelete, setTripToDelete] = useState<Trip | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<TripFilter>('all');
  const [sort, setSort] = useState<TripSort>('updated');
  const [feedback, setFeedback] = useState<string | null>(null);
  const shownTrips = useMemo(() => visibleTrips(trips, query, filter, sort), [trips, query, filter, sort]);

  const handleDelete = async () => {
    if (!tripToDelete || deleting) return;
    setDeleting(true); setFeedback(null);
    try { const title = tripToDelete.title; await deleteTrip(tripToDelete.id); setTripToDelete(null); setFeedback(`${title} and its saved planning data were deleted.`); }
    catch { /* The provider exposes the persistence error above the list. */ }
    finally { setDeleting(false); }
  };

  const handleDuplicate = async (trip: Trip) => {
    if (duplicatingId) return;
    setDuplicatingId(trip.id); setFeedback(null);
    try { const copy = await duplicateTrip(trip.id); setFeedback(`${copy.title} was created as an independent planning copy.`); }
    catch { /* The provider exposes the persistence error above the list. */ }
    finally { setDuplicatingId(null); }
  };

  const handleExport = () => {
    const backup = exportTrips();
    downloadBackup(`${JSON.stringify(backup, null, 2)}\n`);
    setFeedback(`${backup.trips.length} ${backup.trips.length === 1 ? 'trip was' : 'trips were'} exported to a versioned JSON backup.`);
  };

  const controls = <div className={styles.headerActions}>
    {trips.length > 0 && <button className={styles.exportButton} type="button" onClick={handleExport}><Download size={16} aria-hidden="true" />Export backup</button>}
    <Link to="/plan" className={page.buttonLink}><Plus size={16} aria-hidden="true" />New trip</Link>
  </div>;

  return <div className={page.page}>
    <PageHeader title="My Trips" description="Search, organize and reopen journeys saved in this browser." action={controls} />
    {error && <div className={styles.alert}><StatusMessage>{error}</StatusMessage></div>}
    {readWarning && <div className={styles.alert}><StatusMessage>{readWarning}</StatusMessage></div>}
    {syncNotice && <p className={styles.syncNotice} role="status">{syncNotice}</p>}
    {feedback && <p className={styles.feedback} role="status">{feedback}</p>}
    {isLoading ? <p className={page.loading}>Loading your trips…</p> : trips.length === 0 ? <section className={page.empty}>
      <div className={page.emptyInner}><div className={page.emptyIcon}><CalendarDays size={25} strokeWidth={1.7} aria-hidden="true" /></div><h2>Your trips will appear here.</h2><p>Create your first trip to start planning.</p><Link to="/plan" className={page.buttonLink}>Create a trip <ArrowRight size={16} aria-hidden="true" /></Link></div>
    </section> : <section className={`${page.content} ${styles.library}`} aria-label="Saved trips">
      <div className={styles.filters}>
        <div className={styles.filterTabs} role="group" aria-label="Filter trips by status">{tripFilters.map((option) => <button key={option} type="button" aria-pressed={filter === option} onClick={() => setFilter(option)}>{tripFilterLabels[option]}</button>)}</div>
        <label className={styles.search}><Search size={16} aria-hidden="true" /><span className="sr-only">Search trips</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title, destination or origin" /></label>
        <label className={styles.sort}>Sort by<select value={sort} onChange={(event) => setSort(event.target.value as TripSort)}>{tripSorts.map((option) => <option value={option} key={option}>{tripSortLabels[option]}</option>)}</select></label>
      </div>
      {shownTrips.length === 0 ? <div className={styles.noResults}><h2>No matching trips.</h2><p>Try another search or status filter.</p><button type="button" onClick={() => { setQuery(''); setFilter('all'); }}>Clear filters</button></div> : <>
        <div className={styles.listHeader}><span>Trip</span><span>Dates</span><span>Travelers</span><span>Budget</span><span>Actions</span></div>
        <div className={styles.list}>{shownTrips.map((trip) => <article className={styles.row} key={trip.id}>
          <div className={styles.tripCell}><span className={styles.dot} aria-hidden="true" /><div><h2>{trip.title}</h2><p>{trip.origin} → {trip.destination}</p><span className={styles.status}>{tripStatus(trip)}</span></div></div>
          <div className={styles.metaCell}><span className={styles.mobileLabel}>Dates</span>{formatDateRange(trip.startDate, trip.endDate)}</div>
          <div className={styles.metaCell}><span className={styles.mobileLabel}>Travelers</span>{trip.travelers}</div>
          <div className={styles.metaCell}><span className={styles.mobileLabel}>Budget</span>{formatBudget(trip)}</div>
          <div className={styles.rowActions}>
            <Link className={styles.openLink} to={`/trips/${encodeURIComponent(trip.id)}`} aria-label={`Open ${trip.title}`}>Open</Link>
            <Link className={styles.iconAction} to={`/trips/${encodeURIComponent(trip.id)}/edit`} aria-label={`Edit ${trip.title}`} title="Edit trip"><Pencil size={16} aria-hidden="true" /></Link>
            <button className={styles.iconAction} type="button" disabled={duplicatingId !== null} aria-label={`Duplicate ${trip.title}`} title="Duplicate trip" onClick={() => void handleDuplicate(trip)}>{duplicatingId === trip.id ? <span className={styles.working}>Duplicating…</span> : <Copy size={16} aria-hidden="true" />}</button>
            <button className={`${styles.iconAction} ${styles.deleteButton}`} type="button" aria-label={`Delete ${trip.title}`} title="Delete trip" onClick={() => setTripToDelete(trip)}><Trash2 size={16} aria-hidden="true" /></button>
          </div>
        </article>)}</div>
      </>}
    </section>}
    <ConfirmDialog open={Boolean(tripToDelete)} title="Delete this trip?" description={tripToDelete ? `${tripToDelete.title} and its itinerary, planned stay, transport settings and manual expenses will be removed from this browser. Other trips are not affected.` : ''} confirmLabel="Delete trip" busyLabel="Deleting trip…" busy={deleting} onConfirm={() => void handleDelete()} onCancel={() => setTripToDelete(null)} />
  </div>;
}
