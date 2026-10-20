import { Link } from 'react-router-dom';
import type { Trip } from '../../trips/types/trip';
import { formatDate, tripDuration } from '../../trips/utils/tripFormatters';
import { stayNeedsReview } from '../domain/accommodation';
import styles from './Accommodation.module.css';

export function SelectedStaySummary({ trip }: { trip: Trip }) {
  const stay = trip.selectedStay;
  return <section className={styles.savedStay} aria-label="Planned accommodation"><h2>Accommodation</h2>{stay ? <>
    <strong>{stay.property.name}</strong>{stay.property.place.address && <p>{stay.property.place.address}</p>}
    <p>Check-in: {formatDate(stay.checkIn)} · Check-out: {formatDate(stay.checkOut)} · {tripDuration(stay.checkIn, stay.checkOut) - 1} nights</p>
    <p>Planned · Price unavailable · Availability not checked</p>
    {stayNeedsReview(trip) && <p role="status">Trip details changed. Review this planned stay for the current destination, dates and travelers.</p>}
    <Link to={`/trips/${encodeURIComponent(trip.id)}/accommodation`}>View accommodation</Link>
  </> : <><p>Choose where you would like to stay.</p><Link to={`/trips/${encodeURIComponent(trip.id)}/accommodation`}>Find accommodation</Link></>}</section>;
}
