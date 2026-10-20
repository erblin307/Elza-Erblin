import { TripDetails } from '../components/TripDetails';
import { useWorkspaceTrip } from '../components/TripWorkspaceLayout';
import { formatBudget, formatDate, tripDuration } from '../utils/tripFormatters';
import styles from './TripOverviewPage.module.css';
import { SelectedStaySummary } from '../../accommodation/components/SelectedStaySummary';
import { Link } from 'react-router-dom';
import { calculateBudget, formatMoney } from '../../budget/domain/engine';
import { PlannedTravelSummary } from '../../long-distance-transport/components/PlannedTravelSummary';

export function TripOverviewPage() {
  const trip = useWorkspaceTrip();
  const days = tripDuration(trip.startDate, trip.endDate);
  const budget = calculateBudget(trip);
  return <div className={styles.overview}>
    <section className={styles.section} aria-labelledby="essentials-heading">
      <div className={styles.sectionHeading}><h2 id="essentials-heading">Trip essentials</h2><p>Your route, travel party and dates.</p></div>
      <dl className={styles.essentials}>
        <div><dt>From</dt><dd>{trip.origin}</dd></div>
        <div><dt>Destination</dt><dd>{trip.destination}</dd></div>
        <div><dt>Travelers</dt><dd>{trip.travelers} {trip.travelers === 1 ? 'traveler' : 'travelers'}</dd></div>
        <div><dt>Departure</dt><dd>{formatDate(trip.startDate)}</dd></div>
        <div><dt>Return</dt><dd>{formatDate(trip.endDate)}</dd></div>
      </dl>
    </section>
    <section className={styles.section} aria-labelledby="schedule-heading">
      <div className={styles.sectionHeading}><h2 id="schedule-heading">Schedule & duration</h2></div>
      <dl className={styles.duration}><div><dt>Calendar days</dt><dd>{days}</dd></div><div><dt>Accommodation nights</dt><dd>{days - 1}</dd></div></dl>
    </section>
    <section className={styles.section} aria-labelledby="budget-heading">
      <div className={styles.sectionHeading}><h2 id="budget-heading">Total trip budget</h2><p>For {trip.travelers} {trip.travelers === 1 ? 'traveler' : 'travelers'} in total.</p></div>
      <p className={styles.budget}>{formatBudget(trip)}<span>{trip.budget.currency}</span></p>
      <p className={styles.budgetContext}>{formatMoney(budget.total, trip.budget.currency)} known cost · {budget.status === 'over' ? `${formatMoney(budget.overBy, trip.budget.currency)} over budget` : `${formatMoney(budget.remaining, trip.budget.currency)} remaining`}{budget.unknownSourceCount > 0 ? ' · incomplete estimate' : ''}</p>
      <Link className={styles.sectionLink} to={`/trips/${encodeURIComponent(trip.id)}/budget`}>Open Budget</Link>
    </section>
    <section className={styles.section} aria-labelledby="preferences-heading">
      <div className={styles.sectionHeading}><h2 id="preferences-heading">Travel preferences</h2><p>Your preferred stay and ways to explore.</p></div>
      <TripDetails trip={trip} includeEssentials={false} />
    </section>
    <SelectedStaySummary trip={trip} />
    <PlannedTravelSummary trip={trip} />
    <footer className={styles.footer}>Saved in this browser<span>Last updated {new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(trip.updatedAt))}</span></footer>
  </div>;
}
