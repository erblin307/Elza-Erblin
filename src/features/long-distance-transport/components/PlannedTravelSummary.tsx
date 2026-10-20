import { Link } from 'react-router-dom';
import type { Trip } from '../../trips/types/trip';
import { journeyExpired, journeyNeedsReview } from '../domain/model';
import styles from '../../trips/pages/TripOverviewPage.module.css';

function label(value: string) { return value === 'car' ? 'Long-distance car' : value.charAt(0).toUpperCase() + value.slice(1); }

export function PlannedTravelSummary({ trip }: { trip: Trip }) {
  const journeys = trip.longDistanceTravel?.journeys ?? [];
  return <section className={styles.section} aria-labelledby="planned-travel-heading"><div className={styles.sectionHeading}><h2 id="planned-travel-heading">Long-distance travel</h2><p>Planned arrival and departure—not booking confirmation.</p></div>
    {journeys.length ? <div className={styles.travelList}>{journeys.map((journey) => <div key={journey.id}><span>{journey.direction === 'outbound' ? 'Outbound' : 'Return'}</span><strong>{label(journey.mode)} · {journey.departure.location} → {journey.arrival?.location ?? 'arrival unknown'}</strong><small>{journey.departure.localDateTime.replace('T', ' · ')} · {journeyNeedsReview(trip, journey) ? 'Needs review' : journeyExpired(journey) ? 'Offer expired' : 'Planned'}</small></div>)}</div> : <p className={styles.emptyTravel}>No outbound or return journey is planned.</p>}
    <Link className={styles.sectionLink} to={`/trips/${encodeURIComponent(trip.id)}/travel`}>{journeys.length ? 'View travel details' : 'Plan long-distance travel'}</Link>
  </section>;
}
