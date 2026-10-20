import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../../components/ui/Button';
import { TravelImage } from '../../media/components/TravelImage';
import { calendarDates } from '../../itinerary/domain/scheduling';
import { formatDate, preferenceLabel } from '../../trips/utils/tripFormatters';
import type { Trip } from '../../trips/types/trip';
import type { Place } from '../domain/normalization';
import { placeAlreadyPlanned } from '../services/itineraryPlaces';
import styles from './Places.module.css';

export function PlaceDetails({ place, trip, busy, error, onClose, onRefresh, onAdd }: { place: Place | null; trip: Trip; busy: string | null; error: string | null; onClose: () => void; onRefresh: () => void; onAdd: (dayId: string) => void }) {
  const dialog = useRef<HTMLDialogElement>(null); const heading = useRef<HTMLHeadingElement>(null); const title = useId();
  const [dayId, setDayId] = useState(`day-${trip.startDate}`);
  useEffect(() => { if (place && !dialog.current?.open) { dialog.current?.showModal(); heading.current?.focus(); } else if (!place && dialog.current?.open) dialog.current.close(); }, [place]);
  let dates: string[] = []; try { dates = calendarDates(trip.startDate, trip.endDate); } catch { /* Generator limit also applies to manual additions. */ }
  const occurrence = trip.itinerary?.days.flatMap((day) => day.items).find((item) => item.activityId === place?.id);
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby={title} onCancel={(event) => { event.preventDefault(); if (busy !== 'saving') onClose(); }} onClose={() => { if (place && busy !== 'saving') onClose(); }}>
    {place && <><h2 ref={heading} tabIndex={-1} id={title}>{place.name}</h2><div className={styles.detailImage}><TravelImage image={place.place.image} name={place.name} /></div>
      {busy === 'details' && <p role="status">Loading place details and checking identity-linked media…</p>}
      {error && <p role="alert">{error}</p>}
      {place.description && <p>{place.description}</p>}
      <dl className={styles.details}><div><dt>Categories</dt><dd>{place.categories.map(preferenceLabel).join(', ')}</dd></div>{place.place.address && <div><dt>Address</dt><dd>{place.place.address}</dd></div>}<div><dt>Coordinates</dt><dd>{place.location.latitude}, {place.location.longitude}</dd></div>{place.place.website && <div><dt>Website</dt><dd><a href={place.place.website} target="_blank" rel="noopener noreferrer">Visit source website</a></dd></div>}
        <div><dt>Price</dt><dd>Price information unavailable. Unknown does not mean free.</dd></div><div><dt>Duration</dt><dd>Venue duration unavailable. Scheduling uses a {trip.itinerary?.config.unknownDurationMinutes ?? 60}-minute planning assumption.</dd></div><div><dt>Opening hours</dt><dd>Opening hours not verified.{place.place.openingHoursRaw && ' Source text is preserved, but has not been parsed or checked against a timezone.'}</dd></div><div><dt>Source</dt><dd>{place.place.attribution}<small>Provider ID: {place.providerId} · Retrieved {formatDate(place.place.fetchedAt.slice(0, 10))}</small></dd></div>
      </dl>
      <Button variant="secondary" disabled={!!busy} onClick={onRefresh}>Refresh source details / photo</Button>
      <form className={styles.addForm} onSubmit={(event) => { event.preventDefault(); onAdd(dayId); }}><label>Itinerary day<select value={dayId} disabled={!!busy} onChange={(event) => setDayId(event.target.value)}>{dates.map((date, index) => <option key={date} value={`day-${date}`}>Day {index + 1} · {formatDate(date)}</option>)}</select></label><Button type="submit" disabled={!!busy || !dates.length || placeAlreadyPlanned(trip, place)}>{busy === 'saving' ? 'Saving…' : placeAlreadyPlanned(trip, place) ? 'Already planned' : 'Add activity'}</Button></form>
      {!dates.length && <p>Itinerary editing supports trips up to 366 calendar days.</p>}
      {occurrence && <Link className={styles.link} to={`/trips/${encodeURIComponent(trip.id)}/map?item=${encodeURIComponent(occurrence.id)}`}>View planned activity on map</Link>}
      <div className={styles.dialogFooter}><Button variant="secondary" disabled={busy === 'saving'} onClick={onClose}>Close place details</Button></div>
    </>}
  </dialog>;
}
