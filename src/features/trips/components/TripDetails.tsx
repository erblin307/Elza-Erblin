import type { CreateTripInput } from '../types/trip';
import { durationLabel, formatBudget, formatDateRange, paceDescription, preferenceLabel } from '../utils/tripFormatters';
import styles from './TripPlanner.module.css';

export function TripDetails({ trip, includeEssentials = true }: { trip: CreateTripInput; includeEssentials?: boolean }) {
  const preferences = trip.preferences;
  return <dl className={styles.details}>
    {includeEssentials && <>
      <div><dt>From</dt><dd>{trip.origin}</dd></div>
      <div><dt>To</dt><dd>{trip.destination}</dd></div>
      <div><dt>Dates</dt><dd>{formatDateRange(trip.startDate, trip.endDate)}<small>{durationLabel(trip.startDate, trip.endDate)}</small></dd></div>
      <div><dt>Travelers</dt><dd>{trip.travelers}</dd></div>
      <div><dt>Total budget</dt><dd>{formatBudget(trip)}<small>For all travelers</small></dd></div>
    </>}
    {preferences ? <>
      <div><dt>Accommodation</dt><dd>{preferenceLabel(preferences.accommodation)}</dd></div>
      <div><dt>Local transportation</dt><dd>{preferences.transportation.map(preferenceLabel).join(', ') || 'Flexible / no preference'}</dd></div>
      <div><dt>Interests</dt><dd>{preferences.interests.map(preferenceLabel).join(', ') || 'None selected'}</dd></div>
      <div><dt>Travel pace</dt><dd>{preferenceLabel(preferences.pace)}<small>{paceDescription(preferences.pace)}</small></dd></div>
      {preferences.notes && <div className={styles.fullWidth}><dt>Additional notes</dt><dd className={styles.notesText}>{preferences.notes}</dd></div>}
    </> : <div className={styles.fullWidth}><dt>Travel preferences</dt><dd>Not specified. Edit this trip to add your travel style.</dd></div>}
  </dl>;
}
