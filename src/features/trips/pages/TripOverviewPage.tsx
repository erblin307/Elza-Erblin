import { ArrowLeft, CalendarDays, MapPin, Users, Wallet } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { useTrips } from '../../../app/providers/TripsProvider';
import { StatusMessage } from '../../../components/ui/StatusMessage';
import { formatBudget, formatDateRange, tripDuration, tripStatus } from '../utils/tripFormatters';
import page from './Page.module.css';
import styles from './TripOverviewPage.module.css';

export function TripOverviewPage() {
  const { tripId } = useParams();
  const { trips, isLoading, error } = useTrips();
  const trip = trips.find((item) => item.id === tripId);

  if (isLoading) return <div className={page.page}><p className={page.loading}>Loading trip…</p></div>;
  if (!trip) return (
    <div className={page.page}>
      <Link to="/trips" className={styles.back}><ArrowLeft size={16} /> My Trips</Link>
      <section className={page.empty}><div className={page.emptyInner}><h1>Trip not found</h1><p>This trip may have been removed, or the link is no longer valid.</p><Link to="/trips" className={page.buttonLink}>Return to My Trips</Link></div></section>
    </div>
  );

  const days = tripDuration(trip.startDate, trip.endDate);
  return (
    <div className={page.page}>
      <Link to="/trips" className={styles.back}><ArrowLeft size={16} /> My Trips</Link>
      {error && <div className={styles.alert}><StatusMessage>{error}</StatusMessage></div>}
      <header className={styles.hero}>
        <div><span className={styles.status}>{tripStatus(trip)}</span><h1>{trip.title}</h1><p><MapPin size={17} aria-hidden="true" /> {trip.origin} <span>to</span> {trip.destination}</p></div>
        <Link to="/plan" className={styles.newTripLink}>Plan another trip</Link>
      </header>
      <section className={styles.summary} aria-label="Trip summary">
        <article><CalendarDays size={19} aria-hidden="true" /><div><span>Travel dates</span><strong>{formatDateRange(trip.startDate, trip.endDate)}</strong><small>{days} {days === 1 ? 'day' : 'days'}</small></div></article>
        <article><Users size={19} aria-hidden="true" /><div><span>Travel party</span><strong>{trip.travelers} {trip.travelers === 1 ? 'traveler' : 'travelers'}</strong><small>Included in this plan</small></div></article>
        <article><Wallet size={19} aria-hidden="true" /><div><span>Working budget</span><strong>{formatBudget(trip)}</strong><small>Total trip budget</small></div></article>
      </section>
      <section className={styles.routeSection} aria-labelledby="route-summary-heading">
        <div className={styles.sectionTitle}><span>Route summary</span><h2 id="route-summary-heading">From departure to destination</h2></div>
        <div className={styles.routeLine}><div><span className={styles.node} /><small>Origin</small><strong>{trip.origin}</strong></div><div className={styles.line}><span>{days} {days === 1 ? 'day' : 'days'}</span></div><div><span className={styles.node} /><small>Destination</small><strong>{trip.destination}</strong></div></div>
      </section>
    </div>
  );
}
