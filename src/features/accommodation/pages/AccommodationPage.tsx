import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useWorkspaceTrip } from '../../trips/components/TripWorkspaceLayout';
import { useTrips } from '../../../app/providers/TripsProvider';
import type { Trip } from '../../trips/types/trip';
import { formatBudget, formatDateRange, tripDuration } from '../../trips/utils/tripFormatters';
import { Button } from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { TravelImage } from '../../media/components/TravelImage';
import { accommodationRuntime } from '../services/accommodationService';
import { createSelectedStay, stayNeedsReview, type Accommodation } from '../domain/accommodation';
import { accommodationCategories, accommodationLabels, propertyTypeLabel, type AccommodationFilter } from '../domain/categories';
import { rankAccommodation } from '../domain/scoring';
import { PropertyDetails, SourceAttribution } from '../components/PropertyDetails';
import { SelectedStaySummary } from '../components/SelectedStaySummary';
import { accommodationMarker } from '../../map/domain/mapData';
import styles from '../components/Accommodation.module.css';

const InteractiveTripMap = lazy(() => import('../../map/components/InteractiveTripMap').then((module) => ({ default: module.InteractiveTripMap })));
const noActivities: never[] = [];
function AccommodationWorkspace({ trip }: { trip: Trip }) {
  const { saveStay, getStayWarning } = useTrips();
  const discovery = accommodationRuntime.discovery;
  const destination = trip.destinationResolution?.provider === 'geoapify' ? trip.destinationResolution : undefined;
  const [filter, setFilter] = useState<AccommodationFilter>('all');
  const [name, setName] = useState(''); const [radius, setRadius] = useState(5);
  const [properties, setProperties] = useState<Accommodation[]>([]); const [compared, setCompared] = useState<string[]>([]);
  const [focusedId, setFocusedId] = useState<string | null>(null); const [detailsId, setDetailsId] = useState<string | null>(null);
  const [phase, setPhase] = useState<'search' | 'details' | 'saving' | null>(null); const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null); const [feedback, setFeedback] = useState('');
  const [pending, setPending] = useState<Accommodation | 'remove' | null>(null);
  const [view, setView] = useState<'list' | 'map'>('list'); const [focusRequest, setFocusRequest] = useState(0);
  const controller = useRef<AbortController | null>(null); const saving = useRef(false); const lastQuery = useRef('');
  const nights = tripDuration(trip.startDate, trip.endDate) - 1;
  const saved = trip.selectedStay; const stale = stayNeedsReview(trip); const warning = getStayWarning(trip.id);
  const catalog = useMemo(() => [...new Map([...(saved ? [saved.property] : []), ...properties].map((property) => [property.id, property])).values()], [saved, properties]);
  const detail = catalog.find((property) => property.id === detailsId) ?? null;
  const focused = catalog.find((property) => property.id === focusedId);
  const ranked = useMemo(() => destination ? rankAccommodation(properties, trip, destination.location, radius) : [], [properties, trip, destination, radius]);
  const mapProperties = useMemo(() => catalog.map((property) => accommodationMarker(property, property.id === saved?.property.id)), [catalog, saved?.property.id]);
  const comparison = ranked.filter((entry) => compared.includes(entry.property.id));
  const cancel = useCallback(() => { controller.current?.abort(); setPhase(null); }, []);
  useEffect(() => () => controller.current?.abort(), []);
  const begin = useCallback((next: 'search' | 'details') => { controller.current?.abort(); const request = new AbortController(); controller.current = request; setPhase(next); setError(null); setFeedback(''); return request; }, []);
  const search = useCallback(async () => {
    if (!destination || !discovery.geoapify.configured || saving.current) return;
    const request = begin('search'); setSearched(true); lastQuery.current = JSON.stringify([filter, name.trim(), radius]);
    try {
      const result = await discovery.search({ destination, type: filter, radiusKm: radius, name: name.trim() }, request.signal);
      if (!request.signal.aborted) { setProperties(result.properties); setCompared([]); setFocusedId(null); setFeedback(result.rejectedCount ? `${result.rejectedCount} invalid or out-of-area records excluded.` : ''); }
    } catch (cause) { if (!request.signal.aborted) { setProperties([]); setError(cause instanceof Error ? cause.message : 'Accommodation search failed.'); } }
    finally { if (!request.signal.aborted) setPhase(null); }
  }, [destination, discovery, filter, radius, name, begin]);
  useEffect(() => {
    if (!searched || lastQuery.current === JSON.stringify([filter, name.trim(), radius])) return;
    const timer = setTimeout(() => { void search(); }, 400); return () => clearTimeout(timer);
  }, [searched, filter, name, radius, search]);
  const refine = (change: () => void) => { cancel(); setProperties([]); setCompared([]); setFocusedId(null); setDetailsId(null); setError(null); change(); };
  const loadDetails = async (property: Accommodation) => {
    setDetailsId(property.id); setFocusedId(property.id); const request = begin('details');
    try { const updated = await discovery.details(property, request.signal); if (!request.signal.aborted) setProperties((current) => [...current.filter((entry) => entry.id !== property.id), updated]); }
    catch (cause) { if (!request.signal.aborted) setError(cause instanceof Error ? cause.message : 'Property details unavailable.'); }
    finally { if (!request.signal.aborted) setPhase(null); }
  };
  const persist = async (property: Accommodation | null) => {
    if (saving.current) return; saving.current = true; cancel(); setPhase('saving'); setError(null);
    try { await saveStay(trip.id, property ? createSelectedStay(trip, property) : null); setPending(null); setDetailsId(null); setFeedback(property ? `${property.name} selected as your planned stay.` : 'Planned stay removed.'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Your selection could not be saved.'); setPending(null); }
    finally { saving.current = false; setPhase(null); }
  };
  const choose = (property: Accommodation) => {
    if ((saved && saved.property.id !== property.id) || warning) { setDetailsId(null); setPending(property); }
    else void persist(property);
  };
  const focus = (id: string) => { const property = mapProperties.find((entry) => entry.id === id)?.property; if (property) { setFocusedId(property.id); setFocusRequest((current) => current + 1); } };
  return <section className={styles.page} aria-label="Accommodation workspace">
    <header className={styles.heading}><h2>Find accommodation in {trip.destination}</h2><p>{formatDateRange(trip.startDate, trip.endDate)} · {nights} {nights === 1 ? 'night' : 'nights'} · {trip.travelers} {trip.travelers === 1 ? 'traveler' : 'travelers'}</p><p>Total trip budget: {formatBudget(trip)} · Used as trip context; no accommodation amount has been deducted.</p></header>
    <SelectedStaySummary trip={trip} />
    {warning && <p role="alert" className={styles.error}>{warning}</p>}
    {(saved || warning) && <div className={styles.actions}>{saved && <><Button variant="secondary" disabled={!!phase} onClick={() => { setDetailsId(saved.property.id); setError(null); }}>Selected property details</Button><Link to={`/trips/${encodeURIComponent(trip.id)}/map?stay=${encodeURIComponent(saved.property.id)}`}>View planned stay on map</Link></>}<Button variant="secondary" disabled={!!phase} onClick={() => setPending('remove')}>Remove planned stay</Button></div>}
    {!discovery.geoapify.configured && <p className={styles.notice} role="status">Accommodation search requires provider configuration. Saved selections remain accessible.</p>}
    {!destination ? <p className={styles.notice}>Confirm your destination in <Link to={`/trips/${encodeURIComponent(trip.id)}/places`}>Places</Link> to search nearby properties.</p> : <p className={styles.helper}>Search center: {destination.formatted} · {destination.location.latitude.toFixed(5)}, {destination.location.longitude.toFixed(5)}</p>}
    {nights === 0 && <p className={styles.notice}>Your trip has zero accommodation nights. You can browse properties; <Link to={`/trips/${encodeURIComponent(trip.id)}/edit`}>edit trip dates</Link> before selecting an overnight stay.</p>}
    <form className={styles.search} onSubmit={(event) => { event.preventDefault(); void search(); }}><label>Property name<input value={name} maxLength={100} disabled={!destination || !discovery.geoapify.configured || phase === 'saving'} placeholder="Optional property name" onChange={(event) => refine(() => setName(event.target.value))} /></label><label>Search radius<select value={radius} disabled={!destination || phase === 'saving'} onChange={(event) => refine(() => setRadius(Number(event.target.value)))}>{[2,5,10,20].map((value) => <option key={value} value={value}>{value} km</option>)}</select></label><Button type="submit" disabled={!destination || !discovery.geoapify.configured || !!phase}>Find accommodation</Button></form>
    <div role="group" aria-label="Accommodation types" className={styles.filters}>{(Object.keys(accommodationCategories) as AccommodationFilter[]).map((type) => <Button key={type} variant="secondary" aria-pressed={filter === type} disabled={phase === 'saving'} onClick={() => { if (filter !== type) refine(() => setFilter(type)); }}>{accommodationLabels[type]}</Button>)}</div>
    <p className={styles.helper}>Search up to 30 properties within your chosen radius. Your saved preference influences ordering; filters do not change your trip.</p>
    <p className={styles.notice}>Live accommodation prices are not available. Availability and occupancy suitability have not been checked.</p>
    {phase && <p role="status">{phase === 'search' ? 'Finding accommodation…' : phase === 'details' ? 'Loading property details…' : 'Saving planned stay…'}{phase !== 'saving' && <Button variant="ghost" onClick={cancel}>Cancel request</Button>}</p>}
    {error && <p role="alert" className={styles.error}>{error}</p>}{feedback && <p role="status" className={styles.helper}>{feedback}</p>}
    {searched && !ranked.length && !phase && !error && <p className={styles.notice}>No accommodation found in this search area. Choose another type or expand the radius.</p>}
    {!!catalog.length && <div className={styles.filters} role="group" aria-label="Accommodation view"><Button variant="secondary" aria-pressed={view === 'list'} onClick={() => setView('list')}>List</Button><Button variant="secondary" aria-pressed={view === 'map'} onClick={() => setView('map')}>Map</Button></div>}
    {view === 'map' && <><Suspense fallback={<p role="status">Loading map…</p>}><InteractiveTripMap markers={noActivities} propertyMarkers={mapProperties} selectedId={focused ? accommodationMarker(focused).id : null} onSelect={focus} onDetails={(id) => { const property = mapProperties.find((entry) => entry.id === id)?.property; if (property) void loadDetails(property); }} fitRequest={0} focusRequest={focusRequest} /></Suspense>{focused && <section className={styles.mapSelection} aria-label="Focused accommodation"><h3>{focused.name}</h3><p>{focused.place.address}</p><p>{focused.id === saved?.property.id ? 'Selected planned stay' : 'Discovered property'} · Availability not checked</p><Button variant="secondary" disabled={!!phase} onClick={() => void loadDetails(focused)}>Property details</Button></section>}</>}
    {view === 'list' && <ul className={styles.list} aria-label="Accommodation results">{ranked.map(({property, reasons}) => <li className={styles.row} key={property.id} data-focused={focusedId === property.id}>
      <TravelImage image={property.place.image} name={property.name} /><div><h3>{property.name}</h3><p>{property.types.map(propertyTypeLabel).join(' · ')}</p>{property.place.address && <p>{property.place.address}</p>}<p>Price unavailable · Availability not checked</p><p className={styles.reason}>{reasons.join(' ')}</p>{saved?.property.id === property.id && <p className={styles.planned}>Selected for this trip{stale ? ' · Review needed' : ' · Planned'}</p>}
      <div className={styles.actions}><Button variant="secondary" aria-label={`Details for ${property.name}`} disabled={!!phase} onClick={() => void loadDetails(property)}>Details</Button><Button variant="ghost" aria-label={`Select ${property.name}`} disabled={!!phase || !nights || (saved?.property.id === property.id && !stale)} onClick={() => choose(property)}>{saved?.property.id === property.id && !stale ? 'Selected' : 'Select stay'}</Button><Button variant="ghost" aria-label={`View ${property.name} on map`} onClick={() => { setFocusedId(property.id); setFocusRequest((value) => value + 1); setView('map'); }}>View on map</Button></div>
      <label className={styles.compareLabel}><input type="checkbox" checked={compared.includes(property.id)} disabled={!compared.includes(property.id) && compared.length >= 3} onChange={(event) => setCompared((current) => event.target.checked ? [...current, property.id] : current.filter((id) => id !== property.id))} />Compare {property.name}</label></div>
    </li>)}</ul>}
    {!!comparison.length && <div className={styles.comparison}><table><caption>Compare selected results (up to 3)</caption><thead><tr><th scope="col">Attribute</th>{comparison.map(({property}) => <th scope="col" key={property.id}>{property.name}</th>)}</tr></thead><tbody>{['Property type','Address','Distance from search center','Price','Availability','Amenities / classification'].map((label, index) => <tr key={label}><th scope="row">{label}</th>{comparison.map(({property, distanceKm}) => <td key={property.id}>{[property.types.map(propertyTypeLabel).join(', '), property.place.address ?? 'Not supplied', `${distanceKm.toFixed(1)} km straight-line`, 'Unavailable', 'Not checked', 'Not verified'][index]}</td>)}</tr>)}</tbody></table></div>}
    <SourceAttribution />
    <PropertyDetails property={detail} selected={detail?.id === saved?.property.id && !stale} busy={!!phase} zeroNights={!nights} error={error} onClose={() => { if (!saving.current) { cancel(); setDetailsId(null); } }} onSelect={() => { if (detail) choose(detail); }} onRefresh={() => { if (detail) void loadDetails(detail); }} />
    <ConfirmDialog open={pending !== null} title={pending === 'remove' ? 'Remove planned stay?' : 'Replace planned stay?'} description={pending === 'remove' ? 'This clears only the accommodation selection. Your trip and itinerary remain saved.' : `Use ${pending?.name ?? 'this property'} as the primary planned stay for this trip?`} confirmLabel={pending === 'remove' ? 'Remove stay' : 'Replace stay'} variant={pending === 'remove' ? 'danger' : 'primary'} busy={phase === 'saving'} onCancel={() => setPending(null)} onConfirm={() => { if (pending) void persist(pending === 'remove' ? null : pending); }} />
  </section>;
}
export function AccommodationPage() {
  const trip = useWorkspaceTrip();
  return <AccommodationWorkspace key={`${trip.id}:${trip.destination}:${trip.destinationResolution?.providerId ?? ''}:${trip.startDate}:${trip.endDate}:${trip.travelers}`} trip={trip} />;
}
