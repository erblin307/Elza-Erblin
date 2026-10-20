import { useEffect, useId, useRef } from 'react';
import { Button } from '../../../components/ui/Button';
import { preferenceLabel } from '../../trips/utils/tripFormatters';
import type { ActivityCandidate, PlanningContext } from '../types/itinerary';
import { activityCost, formatMoney } from '../domain/costs';
import { formatTime } from '../domain/scheduling';
import styles from './Itinerary.module.css';
import { TravelImage } from '../../media/components/TravelImage';

export function ActivityDetailsDialog({ candidate, context, unknownDurationMinutes, close }: { candidate: ActivityCandidate | null; context: PlanningContext; unknownDurationMinutes: number; close: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (candidate && !dialog.open) dialog.showModal();
    if (!candidate && dialog.open) dialog.close();
  }, [candidate]);
  const cost = candidate ? activityCost(candidate, context) : {};
  return <dialog ref={dialogRef} className={styles.dialog} aria-labelledby={titleId} onCancel={close} onClose={close}>
    {candidate && <><h2 id={titleId}>{candidate.name}</h2><p>{candidate.description || 'No description supplied by this source.'}</p>
      {candidate.place?.image && <TravelImage image={candidate.place.image} name={candidate.name} />}
      <dl className={styles.detailList}>
        <div><dt>Categories</dt><dd>{candidate.categories.map(preferenceLabel).join(', ')}</dd></div>
        <div><dt>Duration</dt><dd>{candidate.durationMinutes ? `${candidate.durationMinutes} minutes from source` : `Unknown — the schedule uses a ${unknownDurationMinutes}-minute planning assumption.`}</dd></div>
        <div><dt>Group activity cost</dt><dd>{cost.amount === undefined ? cost.reason : formatMoney(cost.amount, context.currency)}</dd></div>
        {candidate.price && <div><dt>Price input</dt><dd>{formatMoney(candidate.price.amount, candidate.price.currency)} per {candidate.price.unit}{candidate.price.unit === 'entry' ? ` · ${candidate.price.entriesRequired ?? 'unknown'} entries required` : ''}<small>{candidate.price.basis === 'sample_estimate' ? 'Synthetic demonstration estimate, not a real ticket price.' : 'Estimate supplied by the candidate source; not a confirmed booking.'}</small></dd></div>}
        <div><dt>Source</dt><dd>{candidate.sourceName} · {candidate.source}{candidate.providerId && <small>Provider ID: {candidate.providerId}</small>}</dd></div>
        {candidate.place && <div><dt>Place attribution</dt><dd>{candidate.place.attribution}{candidate.place.provider === 'geoapify' && <small><a href="https://www.geoapify.com/" target="_blank" rel="noopener noreferrer">Powered by Geoapify</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors, ODbL</a></small>}{candidate.place.address && <small>{candidate.place.address}</small>}{candidate.place.website && <small><a href={candidate.place.website} target="_blank" rel="noopener noreferrer">Source website</a></small>}</dd></div>}
        <div><dt>Location</dt><dd>{candidate.location ? `${candidate.location.latitude}, ${candidate.location.longitude}` : 'Coordinates not supplied.'}</dd></div>
        <div><dt>Opening hours</dt><dd>{candidate.openingWindows ? candidate.openingWindows.length ? candidate.openingWindows.map((window) => `${window.date}: ${formatTime(window.startMinute)}–${formatTime(window.endMinute)}`).join('; ') : 'Source lists no available windows.' : 'Opening hours not verified.'}</dd></div>
        {candidate.source === 'provider' && candidate.rating !== undefined && <div><dt>Provider rating</dt><dd>{candidate.rating} / 5</dd></div>}
      </dl><Button variant="secondary" onClick={close}>Close details</Button></>}
  </dialog>;
}
