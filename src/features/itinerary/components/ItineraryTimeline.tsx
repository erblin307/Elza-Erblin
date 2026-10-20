import { Fragment, useState } from 'react';
import { TravelTransition } from '../../transport/components/TransportSegments';
import { Link } from 'react-router-dom';
import { Button } from '../../../components/ui/Button';
import { formatDate, preferenceLabel } from '../../trips/utils/tripFormatters';
import { activityCost, costSummary, formatMoney } from '../domain/costs';
import type { ItineraryEdit } from '../domain/editing';
import { formatTime } from '../domain/scheduling';
import type { ActivityCandidate, GeneratedItinerary, ItineraryDay, ItineraryItem } from '../types/itinerary';
import { ActivityDetailsDialog } from './ActivityDetailsDialog';
import styles from './Itinerary.module.css';

function ActivityActions({ item, day, itinerary, busy, onEdit }: { item: ItineraryItem; day: ItineraryDay; itinerary: GeneratedItinerary; busy: boolean; onEdit: (action: ItineraryEdit) => void }) {
  const otherDays = itinerary.days.filter((entry) => entry.id !== day.id);
  const [moveDay, setMoveDay] = useState(otherDays[0]?.id ?? '');
  return <details className={styles.actionsMenu}><summary>Actions<span className="sr-only"> for activity {item.order + 1}</span></summary><div className={styles.actionControls}>
    <div className={styles.actionButtons}><Button variant="secondary" disabled={busy || item.order === 0} onClick={() => onEdit({ type: 'reorder', itemId: item.id, direction: 'up' })}>Move up</Button><Button variant="secondary" disabled={busy || item.order === day.items.length - 1} onClick={() => onEdit({ type: 'reorder', itemId: item.id, direction: 'down' })}>Move down</Button><Button variant="ghost" disabled={busy} onClick={() => onEdit({ type: 'remove', itemId: item.id })}>Remove activity</Button></div>
    {!!otherDays.length && <div className={styles.moveControls}><label>Move to day<select aria-label={`Destination day for activity ${item.order + 1}`} value={moveDay} disabled={busy} onChange={(event) => setMoveDay(event.target.value)}>{otherDays.map((entry) => <option key={entry.id} value={entry.id}>Day {itinerary.days.indexOf(entry) + 1} · {formatDate(entry.date, { day: 'numeric', month: 'short' })}</option>)}</select></label><Button variant="secondary" disabled={busy || !moveDay} onClick={() => onEdit({ type: 'move', itemId: item.id, dayId: moveDay })}>Move activity</Button></div>}
  </div></details>;
}

export function ItineraryTimeline({ itinerary, day, busy, onEdit, selectedItemId }: { itinerary: GeneratedItinerary; day: ItineraryDay; busy: boolean; onEdit: (action: ItineraryEdit) => void; selectedItemId?: string | null }) {
  const [selected, setSelected] = useState<ActivityCandidate | null>(null);
  const [addId, setAddId] = useState('');
  const scheduledIds = new Set(itinerary.days.flatMap((entry) => entry.items.map((item) => item.activityId)));
  const available = itinerary.catalog.filter((candidate) => !scheduledIds.has(candidate.id));
  const total = costSummary(day.items, itinerary.catalog, itinerary.context);
  const entries = [
    ...day.items.map((item) => ({ type: 'activity' as const, start: item.startMinute, item })),
    ...day.breaks.map((block, index) => ({ type: 'break' as const, start: block.startMinute, block, index })),
  ].sort((a, b) => a.start - b.start);

  return <section aria-label={`Day ${itinerary.days.indexOf(day) + 1} schedule`}>
    <header className={styles.dayHeader}><h3>Day {itinerary.days.indexOf(day) + 1} — {formatDate(day.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</h3><p>{day.items.length} {day.items.length === 1 ? 'activity' : 'activities'} · Known estimated costs: {formatMoney(total.knownCost, itinerary.context.currency)}{total.unknownCount > 0 && ` · ${total.unknownCount} ${total.unknownCount === 1 ? 'cost' : 'costs'} unknown or non-comparable`}</p>{day.provisional && <p className={styles.caution}>{itinerary.context.arrivalConstraint?.date === day.date || itinerary.context.departureConstraint?.date === day.date ? 'Travel-day activity window uses the selected journey time; transfer time remains unknown.' : 'Provisional travel day — arrival/departure times are unknown.'}</p>}</header>
    {entries.length ? <ol className={styles.timeline} aria-label="Ordered activities and planning breaks">{entries.map((entry) => {
      if (entry.type === 'break') return <li className={styles.breakRow} key={`break-${entry.index}`}><span className={styles.time}>{formatTime(entry.block.startMinute)}<small>– {formatTime(entry.block.endMinute)}</small></span><div><span className={styles.breakLabel}>{entry.block.label}</span><p>Generic planning gap. No reservation or travel time is implied.</p></div></li>;
      const item = entry.item;
      const candidate = itinerary.catalog.find((candidate) => candidate.id === item.activityId)!;
      const cost = activityCost(candidate, itinerary.context);
      return <Fragment key={item.id}><TravelTransition dayId={day.id} toId={item.id} /><li className={`${styles.activityRow} ${selectedItemId === item.id ? styles.selectedActivity : ''}`} aria-current={selectedItemId === item.id ? 'true' : undefined}>
        <span className={styles.time}>{formatTime(item.startMinute)}<small>– {formatTime(item.endMinute)}</small></span>
        <div className={styles.activityBody}><span className={styles.position}>Activity {item.order + 1}{item.manuallyAdded && ' · added manually'}</span><button className={styles.activityName} onClick={() => setSelected(candidate)} aria-label={`Details for ${candidate.name}`}>{candidate.name}</button>
          <p className={styles.activityMeta}>{candidate.categories.map(preferenceLabel).join(' · ')} · {item.endMinute - item.startMinute} min{item.durationAssumed ? ' (assumed)' : ' (source estimate)'}</p>
          <p className={styles.activityMeta}>{cost.amount === undefined ? cost.reason : `${formatMoney(cost.amount, itinerary.context.currency)} for your party${candidate.price?.basis === 'sample_estimate' ? ' · sample estimate' : ' · source estimate'}`}</p>
          <p className={styles.activityMeta}>{candidate.source === 'fixture' ? 'Development sample' : candidate.sourceName} · {candidate.openingWindows ? 'Scheduled within source opening window' : 'Opening hours not verified'}</p>
          {item.reasons.length > 0 && <p className={styles.explanation}>{item.reasons[0]}</p>}
          <Link className={styles.mapLink} to={`/trips/${encodeURIComponent(itinerary.tripId)}/map?item=${encodeURIComponent(item.id)}`}>View on map</Link>
          <ActivityActions item={item} day={day} itinerary={itinerary} busy={busy} onEdit={onEdit} />
        </div>
      </li>{item.id === day.items.at(-1)?.id && <TravelTransition dayId={day.id} toId={item.id} returnToStay />}</Fragment>;
    })}</ol> : <p className={styles.freeDay}>No activities planned for this day. Available recommendation data may be limited; keep this time free or add an available activity.</p>}
    <details className={styles.addPanel}><summary>Add an available activity</summary><form onSubmit={(event) => { event.preventDefault(); if (addId) onEdit({ type: 'add', activityId: addId, dayId: day.id }); }}>
      <label>Saved candidate pool<select value={available.some((candidate) => candidate.id === addId) ? addId : ''} disabled={busy || !available.length} onChange={(event) => setAddId(event.target.value)}><option value="">{available.length ? 'Choose an activity' : 'All available activities are already scheduled'}</option>{available.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}</select></label><Button type="submit" variant="secondary" disabled={busy || !available.some((candidate) => candidate.id === addId)}>Add activity</Button>
    </form><p>Manual additions still respect day capacity, duplicate prevention, and the known-cost allowance.</p></details>
    <ActivityDetailsDialog candidate={selected} context={itinerary.context} unknownDurationMinutes={itinerary.config.unknownDurationMinutes} close={() => setSelected(null)} />
  </section>;
}
