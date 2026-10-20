import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '../../../components/ui/Button';
import { mapActivities, mapMarkers, selectedStayMarker } from '../../map/domain/mapData';
import { useTransport, useRouteOverlays } from '../components/TransportProvider';
import { TransportSegments } from '../components/TransportSegments';
import { dailyTotals } from '../domain/planner';
import { formatDistance, formatDuration, modeLabels, transportModes, type TransportMode } from '../domain/routing';
import styles from '../components/Transport.module.css';

const InteractiveTripMap = lazy(() => import('../../map/components/InteractiveTripMap').then((module) => ({ default: module.InteractiveTripMap })));
export function TransportPage() {
  const transport = useTransport(); const { trip } = transport; const [query] = useSearchParams();
  const [dayChoice, setDayChoice] = useState(query.get('day'));
  const [view, setView] = useState<'list' | 'map'>('list'); const [markerId, setMarkerId] = useState<string | null>(null);
  const day = trip.itinerary?.days.find((entry) => entry.id === dayChoice) ?? trip.itinerary?.days[0];
  const dayId = day?.id ?? '';
  const deepSegment = query.get('segment');
  const applied = useRef<string | null>(null);
  const { segments: allSegments, select } = transport;
  useEffect(() => { if (deepSegment && applied.current !== deepSegment && allSegments.some((entry) => entry.id === deepSegment)) { applied.current = deepSegment; select(deepSegment); } }, [deepSegment, allSegments, select]);
  const segments = transport.segments.filter((segment) => segment.dayId === dayId);
  const totals = dailyTotals(segments, transport.currentRoute);
  const markers = useMemo(() => mapMarkers(mapActivities(trip.id, trip.itinerary).filter((entry) => entry.dayId === dayId)), [trip.id, trip.itinerary, dayId]);
  const properties = useMemo(() => { const stay = selectedStayMarker(trip.id, trip.selectedStay); return stay ? [stay] : []; }, [trip.id, trip.selectedStay]);
  const overlays = useRouteOverlays(dayId);
  const selected = segments.find((segment) => segment.id === transport.selectedId);
  return <section className={styles.page} aria-label="Local transportation workspace">
    <h2>{trip.destination} · Local transportation</h2>
    <p>Routes follow your itinerary order. Provider durations are estimates, not live traffic or guaranteed arrival times. Fares, fuel, parking and toll costs are unknown.</p>
    {!transport.configured && <p role="status">Routing requires Geoapify configuration. Add the existing public API key with allowed-origin restrictions and restart the application.</p>}
    <p>Public transport is unavailable here: destination coverage and timetables have not been verified.</p>
    {!trip.itinerary ? <p>Create an <Link to={`/trips/${encodeURIComponent(trip.id)}/itinerary`}>itinerary</Link> to plan local connections.</p> : <>
      <div className={styles.toolbar}><label>Travel day<select value={dayId} disabled={transport.busy} onChange={(event) => setDayChoice(event.target.value)}>{trip.itinerary.days.map((entry, index) => <option key={entry.id} value={entry.id}>Day {index + 1} · {entry.date}</option>)}</select></label>
        <label>Default local mode<select value={transport.settings.defaultMode} disabled={transport.busy} onChange={(event) => void transport.saveSettings({ ...transport.settings, defaultMode: event.target.value as TransportMode })}>{transportModes.map((mode) => <option key={mode} value={mode}>{modeLabels[mode]}</option>)}</select></label>
        <Button disabled={transport.busy || !transport.configured || !segments.some((segment) => segment.request)} onClick={() => void transport.calculate(segments)}>Calculate day routes</Button>
      </div>
      <p>Local routing settings save to this trip. Individual connection modes override the default; your original planner preferences stay unchanged.</p>
      <div className={styles.options}><label><input type="checkbox" checked={transport.settings.hotelOrigin} disabled={transport.busy || !trip.selectedStay} onChange={(event) => void transport.saveSettings({ ...transport.settings, hotelOrigin: event.target.checked })} />Start at planned stay</label><label><input type="checkbox" checked={transport.settings.hotelReturn} disabled={transport.busy || !trip.selectedStay} onChange={(event) => void transport.saveSettings({ ...transport.settings, hotelReturn: event.target.checked })} />Return to planned stay</label></div>
      {!trip.selectedStay && <p>No accommodation selected. Only activity-to-activity connections are planned.</p>}
      {day?.provisional && <p>Provisional first/last day: arrival and departure times are unknown. No hotel departure time is assumed.</p>}
      {transport.busy && <p role="status">Calculating routes or saving transport settings…</p>}
      {transport.error && <p role="alert" className={styles.warning}>{transport.error}</p>}
      {!day?.items.length ? <p>No activities planned for this day.</p> : !segments.length ? <p>No travel connections for this day. A single activity needs no activity-to-activity route.</p> : <>
        <div className={styles.summary} aria-label="Daily travel summary"><strong>{totals.complete ? 'Calculated connections' : 'Incomplete day totals'} · {totals.available} of {totals.total} connections</strong><p>{totals.available ? `${formatDistance(totals.distanceMeters)} · ${formatDuration(totals.durationSeconds)} estimated travel across calculated connections` : 'Distance and travel time are unknown until routes are calculated.'}</p></div>
        <div className={styles.actions} role="group" aria-label="Transport view"><Button variant="secondary" aria-pressed={view === 'list'} onClick={() => setView('list')}>List</Button><Button variant="secondary" aria-pressed={view === 'map'} onClick={() => setView('map')}>Map</Button></div>
        {view === 'list' ? <TransportSegments dayId={dayId} /> : <Suspense fallback={<p role="status">Loading map…</p>}><InteractiveTripMap markers={markers} propertyMarkers={properties} selectedId={markerId} onSelect={setMarkerId} onDetails={setMarkerId} fitRequest={0} focusRequest={0} routes={overlays} selectedRouteId={transport.selectedId} onRouteSelect={transport.select} routeFocusRequest={transport.focusRequest} /></Suspense>}
        {selected && <section aria-label="Selected travel connection"><h3>{selected.from.name} → {selected.to.name}</h3><p>{transport.status(selected)}</p><table className={styles.comparison}><caption>Provider-calculated mode comparison</caption><thead><tr><th>Mode</th><th>Distance</th><th>Estimated duration</th></tr></thead><tbody>{transportModes.map((mode) => { const route = transport.currentRoute(selected, mode); return <tr key={mode}><th>{modeLabels[mode]}</th><td>{route ? formatDistance(route.distanceMeters) : 'Not available'}</td><td>{route ? formatDuration(route.estimatedDurationSeconds) : 'Not calculated or unavailable'}</td></tr>; })}</tbody></table><Link to={`/trips/${encodeURIComponent(trip.id)}/itinerary?day=${encodeURIComponent(dayId)}`}>View itinerary</Link></section>}
        <p><a href="https://www.geoapify.com/" target="_blank" rel="noreferrer">Powered by Geoapify</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>. Only returned route geometry is drawn; no straight-line substitutes.</p>
      </>}
    </>}
  </section>;
}
