import { useCallback, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '../../../components/ui/Button';
import { useTrips } from '../../../app/providers/TripsProvider';
import { useWorkspaceTrip } from '../../trips/components/TripWorkspaceLayout';
import type { Trip } from '../../trips/types/trip';
import { formatDate } from '../../trips/utils/tripFormatters';
import { isItineraryStale } from '../../itinerary/domain/context';
import { ActivityDetailsDialog } from '../../itinerary/components/ActivityDetailsDialog';
import { filterActivities, mapActivities, mapMarkers, selectedStayMarker } from '../domain/mapData';
import { stayNeedsReview } from '../../accommodation/domain/accommodation';
import { PropertyDetails } from '../../accommodation/components/PropertyDetails';
import { InteractiveTripMap } from '../components/InteractiveTripMap';
import { MapActivityList } from '../components/MapActivityList';
import styles from '../components/MapWorkspace.module.css';
import { useTransport, useRouteOverlays } from '../../transport/components/TransportProvider';
import { TransportSegments } from '../../transport/components/TransportSegments';

function TripMapContent({ trip }: { trip: Trip }) {
  const [query] = useSearchParams();
  const activities = useMemo(() => mapActivities(trip.id, trip.itinerary), [trip.id, trip.itinerary]);
  const stayMarker = useMemo(() => selectedStayMarker(trip.id, trip.selectedStay), [trip.id, trip.selectedStay]);
  const propertyMarkers = useMemo(() => stayMarker ? [stayMarker] : [], [stayMarker]);
  const [selection, setSelection] = useState({ dayId: 'all', itemId: (stayMarker?.property.id === query.get('stay') ? stayMarker.id : activities.find((entry) => entry.id === query.get('item'))?.id) ?? null as string | null });
  const [view, setView] = useState<'list' | 'map'>('map');
  const [fitRequest, setFitRequest] = useState(0);
  const [focusRequest, setFocusRequest] = useState(0);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const { getItineraryWarning } = useTrips();
  const itinerary = trip.itinerary;
  const dayId = selection.dayId === 'all' || itinerary?.days.some((day) => day.id === selection.dayId) ? selection.dayId : 'all';
  const transport = useTransport();
  const routeOverlays = useRouteOverlays(dayId);
  const visible = useMemo(() => filterActivities(activities, dayId), [activities, dayId]);
  const markers = useMemo(() => mapMarkers(visible), [visible]);
  const selected = visible.find((entry) => entry.id === selection.itemId);
  const selectedProperty = stayMarker?.id === selection.itemId ? stayMarker : null;
  const selectedId = selected?.id ?? selectedProperty?.id ?? null;
  if (selection.dayId !== dayId || (selection.itemId !== null && !selected && !selectedProperty)) setSelection({ dayId, itemId: selectedId });
  const select = useCallback((id: string) => { setSelection((current) => ({ ...current, itemId: id })); setFocusRequest((value) => value + 1); }, []);
  const details = useCallback((id: string) => { select(id); setDetailsOpen(true); }, [select]);
  const path = `/trips/${encodeURIComponent(trip.id)}/itinerary`;
  return <section className={styles.page} aria-label="Trip map workspace">
    <header className={styles.heading}><h2>{trip.destination} — Trip map</h2><p>{itinerary?.days.length ?? 0} days · {markers.length} of {visible.length} activities mapped in this filter</p></header>
    {itinerary && isItineraryStale(trip, itinerary) && <p className={styles.notice} role="status">Trip preferences changed. This map shows your preserved, outdated itinerary—not a new plan for the current destination. Review or regenerate in Itinerary.</p>}
    {itinerary?.metadata.dataMode === 'demo' && <p className={styles.notice}>{itinerary.metadata.sourceLabel.startsWith('Mixed itinerary') ? 'Mixed itinerary — includes provider places and development fixtures. Each activity retains its source.' : 'Demonstration itinerary. Only source-supplied landmark coordinates are mapped; generic exercises remain unmapped.'} No routes or verified availability.</p>}
    {stayNeedsReview(trip) && <p className={styles.notice} role="status">Your preserved planned stay needs review after trip changes. Its marker shows the saved property location.</p>}
    {!itinerary && !stayMarker ? <div className={styles.mapEmpty}><h3>No saved itinerary yet</h3><p>{getItineraryWarning(trip.id) ?? 'Generate an itinerary or select accommodation to explore saved locations.'}</p><Link to={path}>Open Itinerary</Link><Link to={`/trips/${encodeURIComponent(trip.id)}/accommodation`}>Find accommodation</Link></div> : <>
      <div className={styles.toolbar}><label>Show itinerary day<select value={dayId} onChange={(event) => { const next = event.target.value; setSelection({ dayId: next, itemId: selectedProperty || activities.some((entry) => entry.id === selection.itemId && (next === 'all' || entry.dayId === next)) ? selection.itemId : null }); setDetailsOpen(false); }}><option value="all">All days</option>{itinerary?.days.map((day, index) => <option key={day.id} value={day.id}>Day {index + 1} · {formatDate(day.date, { month: 'short', day: 'numeric' })}</option>)}</select></label><Button variant="secondary" disabled={!markers.length && !propertyMarkers.length} onClick={() => { setSelection((current) => ({ ...current, itemId: null })); setFitRequest((value) => value + 1); }}>Fit locations</Button><Link to={path}>Edit itinerary</Link></div>
      <div className={styles.viewSwitch} role="group" aria-label="Map workspace view"><Button variant="secondary" aria-pressed={view === 'list'} onClick={() => setView('list')}>List</Button><Button variant="secondary" aria-pressed={view === 'map'} onClick={() => setView('map')}>Map</Button></div>
      <div className={styles.split} data-view={view}><div className={styles.listPanel}>{stayMarker && <><h3>Planned accommodation</h3><button type="button" className={styles.activityRow} aria-pressed={!!selectedProperty} onClick={() => select(stayMarker.id)} aria-label={`Select planned stay ${stayMarker.property.name}`}><span className={styles.ordinal}>Stay</span><span><strong>{stayMarker.property.name}</strong><span>Planned · Availability not checked</span></span></button></>}<h3>Itinerary locations</h3><MapActivityList activities={visible} selectedId={selected?.id ?? null} onSelect={select} /><h3>Travel connections</h3><TransportSegments dayId={dayId} compact /><Link to={`/trips/${encodeURIComponent(trip.id)}/transport`}>Calculate or compare routes</Link></div><div className={styles.mapPanel}><InteractiveTripMap markers={markers} propertyMarkers={propertyMarkers} selectedId={selectedId} onSelect={select} onDetails={details} fitRequest={fitRequest} focusRequest={focusRequest} routes={routeOverlays} selectedRouteId={transport.selectedId} onRouteSelect={transport.select} routeFocusRequest={transport.focusRequest} /></div></div>
      {selected && <section className={styles.selection} aria-label="Selected map activity" aria-live="polite"><span>Selected · Day {selected.dayNumber}, activity {selected.item.order + 1}</span><h3>{selected.candidate?.name ?? 'Activity details unavailable'}</h3><p>{selected.location ? `${selected.location.latitude.toFixed(6)}, ${selected.location.longitude.toFixed(6)} · ${selected.candidate?.sourceName}` : 'Location unavailable. This activity cannot currently be displayed on the map.'}</p><div>{selected.location && <Button className={styles.mobileLocation} variant="secondary" onClick={() => { setView('map'); setFocusRequest((value) => value + 1); }}>View location</Button>}{selected.candidate && <Button variant="secondary" onClick={() => setDetailsOpen(true)}>Activity details</Button>}<Link to={`${path}?day=${encodeURIComponent(selected.dayId)}&item=${encodeURIComponent(selected.id)}`}>View in itinerary</Link></div></section>}
      <p className={styles.footnote}>Numbers identify day.activity order, not a travel route. Tiles retain their original style in both themes. No GPS location is requested.</p>
      {selectedProperty && <section className={styles.selection} aria-label="Selected map accommodation"><span>Planned stay</span><h3>{selectedProperty.property.name}</h3><p>{selectedProperty.location.latitude.toFixed(6)}, {selectedProperty.location.longitude.toFixed(6)} · Geoapify / OpenStreetMap</p><p>Price unavailable · Availability not checked</p><div><Button variant="secondary" onClick={() => setDetailsOpen(true)}>Property details</Button><Link to={`/trips/${encodeURIComponent(trip.id)}/accommodation`}>Change accommodation</Link></div></section>}
      {itinerary && <ActivityDetailsDialog candidate={detailsOpen ? selected?.candidate ?? null : null} context={itinerary.context} unknownDurationMinutes={itinerary.config.unknownDurationMinutes} close={() => setDetailsOpen(false)} />}
      <PropertyDetails property={detailsOpen && selectedProperty ? selectedProperty.property : null} selected busy={false} zeroNights={false} error={null} onClose={() => setDetailsOpen(false)} onSelect={() => {}} />
    </>}
  </section>;
}
export function TripMapPage() { const trip = useWorkspaceTrip(); return <TripMapContent key={trip.id} trip={trip} />; }
