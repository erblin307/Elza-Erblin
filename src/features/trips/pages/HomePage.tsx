import { ArrowRight, Route } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../../components/ui/PageHeader';
import { StatusMessage } from '../../../components/ui/StatusMessage';
import { useTrips } from '../../../app/providers/TripsProvider';
import { formatDateRange, tripStatus } from '../utils/tripFormatters';
import page from './Page.module.css';
import styles from './HomePage.module.css';

export function HomePage() {
  const { trips, isLoading, error } = useTrips();
  const current = trips.find((trip) => tripStatus(trip) !== 'Past') ?? trips[0];
  return (
    <div className={page.page}>
      <PageHeader title="Home" description="Your travel planning workspace." />
      {error && <div className={styles.alert}><StatusMessage>{error}</StatusMessage></div>}
      {isLoading ? <p className={page.loading}>Loading your trips…</p> : !current ? (
        <section className={page.empty}>
          <div className={page.emptyInner}>
            <div className={page.emptyIcon}><Route size={26} strokeWidth={1.7} aria-hidden="true" /></div>
            <h2>Plan your next journey.</h2>
            <p>Organize destinations, dates, travelers and budget in one focused place.</p>
            <Link to="/plan" className={page.buttonLink}>Create a trip <ArrowRight size={16} aria-hidden="true" /></Link>
          </div>
        </section>
      ) : (
        <section className={`${page.content} ${styles.continueSection}`}>
          <div className={styles.eyebrow}>Continue planning</div>
          <Link to={`/trips/${current.id}`} className={styles.tripPanel}>
            <div className={styles.routeVisual} aria-hidden="true"><span /><div /><span /></div>
            <div className={styles.tripCopy}>
              <span className={styles.status}>{tripStatus(current)}</span>
              <h2>{current.title}</h2>
              <p>{current.origin} <ArrowRight size={14} aria-hidden="true" /> {current.destination}</p>
              <span>{formatDateRange(current.startDate, current.endDate)} · {current.travelers} {current.travelers === 1 ? 'traveler' : 'travelers'}</span>
            </div>
            <ArrowRight className={styles.openIcon} size={20} aria-label="Open trip" />
          </Link>
          <div className={styles.quickActions}><Link to="/trips">View all trips</Link><Link to="/plan">Plan another trip</Link></div>
        </section>
      )}
    </div>
  );
}
