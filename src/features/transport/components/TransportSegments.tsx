import { Link } from 'react-router-dom';
import { Button } from '../../../components/ui/Button';
import { useTransport, useOptionalTransport } from './TransportProvider';
import { detectTravelConflict, type RouteSegment } from '../domain/planner';
import { formatDistance, formatDuration, modeLabels, transportModes, type TransportMode } from '../domain/routing';
import styles from './Transport.module.css';

function Conflict({ segment, duration }: { segment: RouteSegment; duration?: number }) {
  const state = detectTravelConflict(segment.from.item, segment.to.item, duration);
  return <p className={state === 'conflict' ? styles.warning : undefined}>{state === 'conflict' ? 'The current schedule may not allow enough travel time between these activities.' : state === 'fits' ? 'Estimated travel fits the scheduled gap; visit durations and arrival times remain provisional.' : 'Schedule feasibility unknown — timing or route data is missing.'}</p>;
}
export function TransportSegments({ dayId = 'all', compact = false }: { dayId?: string; compact?: boolean }) {
  const transport = useTransport();
  const segments = transport.segments.filter((segment) => dayId === 'all' || segment.dayId === dayId);
  return <ul className={styles.list} aria-label="Travel connections">{segments.map((segment) => {
    const route = transport.currentRoute(segment);
    return <li key={segment.id} className={styles.row} data-selected={transport.selectedId === segment.id}>
      <button type="button" className={styles.select} aria-pressed={transport.selectedId === segment.id} onClick={() => transport.select(segment.id)}>{segment.from.name} → {segment.to.name}</button>
      <p>{modeLabels[segment.mode]} · {route ? `${formatDistance(route.distanceMeters)} · ${formatDuration(route.estimatedDurationSeconds)} estimated` : transport.status(segment)}</p>
      {transport.selectedId === segment.id && <p>Selected connection</p>}
      {!compact && <><Conflict segment={segment} duration={route?.estimatedDurationSeconds} /><div className={styles.actions}>
        <label>Mode for {segment.from.name} → {segment.to.name}<select value={segment.mode} disabled={transport.busy} onChange={(event) => void transport.saveSettings({ ...transport.settings, segmentModes: { ...transport.settings.segmentModes, [segment.id]: event.target.value as TransportMode } })}>{transportModes.map((mode) => <option key={mode} value={mode}>{modeLabels[mode]}</option>)}</select></label>
        <Button variant="secondary" disabled={transport.busy || !segment.request || !transport.configured} onClick={() => void transport.calculate([segment])}>Calculate connection</Button>
        <Button variant="secondary" disabled={transport.busy || !segment.request || !transport.configured} onClick={() => { transport.select(segment.id); void transport.calculate([segment], true); }}>Compare modes</Button>
      </div></>}
    </li>;
  })}</ul>;
}
export function TravelTransition({ dayId, toId, returnToStay = false }: { dayId: string; toId: string; returnToStay?: boolean }) {
  const transport = useOptionalTransport();
  const segment = transport?.segments.find((entry) => entry.dayId === dayId && (returnToStay ? entry.from.id === toId && !entry.to.item : entry.to.id === toId));
  if (!transport || !segment) return null;
  const route = transport.currentRoute(segment);
  return <li className={styles.transition} aria-label={`Travel from ${segment.from.name} to ${segment.to.name}`}>
    <Link onClick={() => transport.select(segment.id)} to={`/trips/${encodeURIComponent(segment.tripId)}/transport?day=${encodeURIComponent(dayId)}&segment=${encodeURIComponent(segment.id)}`}>{segment.from.name} → {segment.to.name}</Link>
    <span> · {modeLabels[segment.mode]} · {route ? `${formatDuration(route.estimatedDurationSeconds)} estimated · ${formatDistance(route.distanceMeters)}` : transport.status(segment)}</span>
    {transport.selectedId === segment.id && <span> · Selected connection</span>}
    <Conflict segment={segment} duration={route?.estimatedDurationSeconds} />
  </li>;
}
