import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../../components/ui/Button';
import { useTrips } from '../../../app/providers/TripsProvider';
import { useWorkspaceTrip } from '../../trips/components/TripWorkspaceLayout';
import type { Trip } from '../../trips/types/trip';
import type { DestinationResolution } from '../../trips/validation/destinationSchema';
import { canonicalDestination } from '../../../shared/validation/location';
import { discoveryCategories, type PlaceFilter } from '../domain/categories';
import type { Place } from '../domain/normalization';
import { getPlacesProvider, placesRuntime } from '../services/placesService';
import { addDiscoveredPlace } from '../services/itineraryPlaces';
import { PlaceList } from '../components/PlaceList';
import { PlaceDetails } from '../components/PlaceDetails';
import styles from '../components/Places.module.css';

function Discovery({ trip }: { trip: Trip }) {
  const { saveDestination, saveItinerary } = useTrips();
  const [mode, setMode] = useState<'geoapify' | 'fixture'>(trip.destinationResolution?.provider ?? 'geoapify');
  const [matches, setMatches] = useState<DestinationResolution[]>([]); const [matchId, setMatchId] = useState('');
  const [filter, setFilter] = useState<PlaceFilter>('all'); const [radius, setRadius] = useState(5); const [name, setName] = useState('');
  const [places, setPlaces] = useState<Place[]>([]); const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null); const [error, setError] = useState<string | null>(null); const [feedback, setFeedback] = useState('');
  const [searched, setSearched] = useState(false); const [resolvedEmpty, setResolvedEmpty] = useState(false);
  const controller = useRef<AbortController | null>(null); const saving = useRef(false); const lastQuery = useRef('');
  const resolution = trip.destinationResolution?.provider === mode ? trip.destinationResolution : undefined;
  const configured = mode === 'fixture' || placesRuntime.live.configured;
  const selected = places.find((place) => place.id === selectedId) ?? null;
  const cancel = useCallback(() => { controller.current?.abort(); setBusy(null); }, []);
  useEffect(() => () => controller.current?.abort(), []);
  const begin = useCallback((phase: string) => { controller.current?.abort(); const request = new AbortController(); controller.current = request; setBusy(phase); setError(null); setFeedback(''); return request; }, []);
  const failure = (request: AbortController, cause: unknown) => { if (!request.signal.aborted) setError(cause instanceof Error ? cause.message : 'The request could not be completed. Your saved trip is safe.'); };
  const finish = (request: AbortController) => { if (!request.signal.aborted) setBusy(null); };
  const findDestination = async () => {
    const request = begin('resolving'); setMatches([]); setMatchId(''); setResolvedEmpty(false);
    try { const provider = await getPlacesProvider(mode); const found = await provider.resolve(trip.destination, request.signal); if (!request.signal.aborted) { setMatches(found); setResolvedEmpty(!found.length); } }
    catch (cause) { failure(request, cause); } finally { finish(request); }
  };
  const confirmDestination = async () => {
    const match = matches.find((entry) => entry.providerId === matchId); if (!match || saving.current) return;
    saving.current = true; const request = begin('saving');
    try { await saveDestination(trip.id, match); setPlaces([]); setSelectedId(null); setSearched(false); setMatches([]); setFeedback('Destination confirmed. Your original destination text is unchanged.'); }
    catch (cause) { failure(request, cause); } finally { saving.current = false; finish(request); }
  };
  const search = useCallback(async () => {
    if (!resolution || !configured || saving.current) return;
    const request = begin('searching'); lastQuery.current = JSON.stringify([resolution.providerId, filter, radius, name.trim(), mode]); setSearched(true); setSelectedId(null);
    try { const provider = await getPlacesProvider(mode); const result = await provider.search({ destination: resolution, categories: [...discoveryCategories[filter]], name: name.trim(), radiusKm: radius }, request.signal); if (!request.signal.aborted) { setPlaces(result.places); setFeedback(result.rejectedCount ? `${result.rejectedCount} malformed or conflicting records were excluded.` : ''); } }
    catch (cause) { if (!request.signal.aborted) { setPlaces([]); setError(cause instanceof Error ? cause.message : 'Places could not be found.'); } }
    finally { if (!request.signal.aborted) setBusy(null); }
  }, [resolution, configured, begin, filter, radius, name, mode]);
  useEffect(() => {
    if (!searched || !resolution || lastQuery.current === JSON.stringify([resolution.providerId, filter, radius, name.trim(), mode])) return;
    const timer = setTimeout(() => { void search(); }, 400); return () => clearTimeout(timer);
  }, [searched, resolution, filter, radius, name, mode, search]);
  const details = async (id: string) => {
    const place = places.find((entry) => entry.id === id); if (!place) return;
    setSelectedId(id); const request = begin('details');
    try {
      const provider = await getPlacesProvider(mode); const enriched = await provider.details(place, request.signal);
      const image = await placesRuntime.media.resolve(enriched, request.signal);
      if (!request.signal.aborted) setPlaces((current) => current.map((entry) => entry.id === id ? { ...enriched, place: { ...enriched.place, image: image ?? undefined } } : entry));
    } catch (cause) { failure(request, cause); } finally { finish(request); }
  };
  const add = async (dayId: string) => {
    if (!selected || saving.current) return;
    saving.current = true; const request = begin('saving');
    try { await saveItinerary(trip.id, addDiscoveredPlace(trip, selected, dayId)); setFeedback(`${selected.name} added to your saved itinerary.`); }
    catch (cause) { failure(request, cause); } finally { saving.current = false; finish(request); }
  };
  const refine = (change: () => void) => { cancel(); setPlaces([]); setSelectedId(null); change(); };
  return <section className={styles.page} aria-label="Places discovery workspace">
    <header><h2>Places in {trip.destination}</h2><p>Discover real places and add them to your existing day-by-day plan.</p></header>
    <label className={styles.source}>Place data source<select value={mode} disabled={busy === 'saving'} onChange={(event) => refine(() => { setMode(event.target.value as typeof mode); setMatches([]); setMatchId(''); setSearched(false); })}><option value="geoapify">Geoapify — live place discovery</option><option value="fixture">Development fixtures — sourced landmarks only</option></select></label>
    {!configured && <p className={styles.notice} role="status">Places discovery requires provider configuration. Set VITE_GEOAPIFY_API_KEY in a local environment file and restrict the public browser key to your allowed origins. Saved trips, itineraries and maps remain accessible.</p>}
    {mode === 'fixture' && <p className={styles.notice}>Development fixtures, not Geoapify results. Rome/Vienna landmark points are static sourced snapshots. The demonstration area is not a geocoded city center; no restaurants, prices or hours are invented.</p>}
    <section className={styles.destination} aria-label="Destination resolution"><h3>Confirm your destination</h3>{resolution && <p>{resolution.formatted}<small>{resolution.location.latitude.toFixed(6)}, {resolution.location.longitude.toFixed(6)} · {resolution.provider}</small></p>}<Button variant="secondary" disabled={!configured || !!busy} onClick={() => void findDestination()}>{resolution ? 'Find destination again' : 'Find destination matches'}</Button>
      {!!matches.length && <fieldset><legend>Select the correct location — nothing is chosen automatically</legend>{matches.map((match) => <label key={match.providerId}><input type="radio" name="destination-match" checked={matchId === match.providerId} onChange={() => setMatchId(match.providerId)} />{match.formatted}<small>{match.location.latitude.toFixed(5)}, {match.location.longitude.toFixed(5)}</small></label>)}<Button disabled={!matchId || !!busy} onClick={() => void confirmDestination()}>Confirm destination</Button></fieldset>}
      {resolvedEmpty && <p role="status">No matching destination found. Refine the destination in <Link to={`/trips/${encodeURIComponent(trip.id)}/edit`}>Edit trip</Link>.</p>}
    </section>
    <form className={styles.search} onSubmit={(event) => { event.preventDefault(); void search(); }}><label>Search place names<input value={name} maxLength={100} disabled={!resolution || !configured || busy === 'saving'} placeholder="Optional place name" onChange={(event) => refine(() => setName(event.target.value))} /></label><label>Search radius<select value={radius} disabled={!resolution || busy === 'saving'} onChange={(event) => refine(() => setRadius(Number(event.target.value)))}>{[2, 5, 10, 20].map((value) => <option value={value} key={value}>{value} km</option>)}</select></label><Button type="submit" disabled={!resolution || !configured || !!busy}>Search places</Button></form>
    <div className={styles.filters} role="group" aria-label="Place categories">{(Object.keys(discoveryCategories) as PlaceFilter[]).map((value) => <Button key={value} variant="secondary" aria-pressed={filter === value} disabled={!resolution || busy === 'saving'} onClick={() => refine(() => setFilter(value))}>{value === 'all' ? 'All places' : value[0]!.toUpperCase() + value.slice(1)}</Button>)}</div>
    <p className={styles.helper}>{mode === 'fixture' ? 'Filters search the limited offline fixture dataset.' : 'Fresh provider category/name search, limited to 30 results within the selected radius. After the first search, changes are debounced for 400 ms.'} This is not an exhaustive city guide. Missing prices are unknown; times are planning assumptions.</p>
    {busy && <p role="status">{busy === 'resolving' ? 'Resolving destination…' : busy === 'searching' ? `Finding places in ${trip.destination}…` : busy === 'details' ? 'Loading place details…' : 'Saving your trip…'}{busy !== 'saving' && <Button variant="ghost" onClick={cancel}>Cancel request</Button>}</p>}
    {error && <p className={styles.error} role="alert">{error}</p>}{feedback && <p role="status" className={styles.helper}>{feedback}</p>}
    {searched && !places.length && !busy && !error && <p className={styles.empty}>No places found for this category. Choose another category or expand the search radius.</p>}
    <PlaceList places={places} trip={trip} busy={!!busy} onDetails={(id) => void details(id)} onAdd={(id) => { setSelectedId(id); setError(null); }} />
    {mode === 'geoapify' && <p className={styles.attribution}><a href="https://www.geoapify.com/" target="_blank" rel="noopener noreferrer">Powered by Geoapify</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors, ODbL</a></p>}
    <PlaceDetails key={selected?.id ?? 'closed'} place={selected} trip={trip} busy={busy} error={error} onClose={() => { if (!saving.current) { cancel(); setSelectedId(null); } }} onRefresh={() => { if (selected) void details(selected.id); }} onAdd={(dayId) => void add(dayId)} />
  </section>;
}
export function PlacesPage() { const trip = useWorkspaceTrip(); return <Discovery key={`${trip.id}:${canonicalDestination(trip.destination)}`} trip={trip} />; }
