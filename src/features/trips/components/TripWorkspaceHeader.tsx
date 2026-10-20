import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, Pencil } from 'lucide-react';
import type { Trip } from '../types/trip';
import { formatDateRange, tripStatus } from '../utils/tripFormatters';
import styles from './TripWorkspace.module.css';

export function TripWorkspaceHeader({ trip }: { trip: Trip }) {
  const { pathname } = useLocation();
  const editing = pathname.endsWith('/edit');
  const itinerary = pathname.endsWith('/itinerary');
  const map = pathname.endsWith('/map');
  const places = pathname.endsWith('/places');
  const accommodation = pathname.endsWith('/accommodation');
  const transport = pathname.endsWith('/transport');
  const budget = pathname.endsWith('/budget');
  const tripPath = `/trips/${encodeURIComponent(trip.id)}`;
  return <header className={styles.header}>
    <nav aria-label="Breadcrumb" className={styles.breadcrumb}><Link to="/trips">My Trips</Link><span aria-hidden="true">/</span><span>{pathname.endsWith('/assistant') ? 'Assistant' : pathname.endsWith('/travel') ? 'Travel' : editing ? 'Edit trip' : budget ? 'Budget' : transport ? 'Transport' : accommodation ? 'Accommodation' : places ? 'Places' : map ? 'Map' : itinerary ? 'Itinerary' : 'Overview'}</span></nav>
    <div className={styles.headerRow}>
      <div className={styles.headingGroup}><h1 title={trip.title}>{trip.title}</h1><p className={styles.route}>{trip.origin}<ArrowRight size={14} aria-hidden="true" />{trip.destination}</p><p className={styles.metadata}><span>{formatDateRange(trip.startDate, trip.endDate)}</span><span>{trip.travelers} {trip.travelers === 1 ? 'traveler' : 'travelers'}</span><span className={styles.status}>{tripStatus(trip)}</span></p></div>
      {!editing && <Link to={`${tripPath}/edit`} className={styles.primaryLink}><Pencil size={15} aria-hidden="true" />Edit trip</Link>}
    </div>
  </header>;
}
