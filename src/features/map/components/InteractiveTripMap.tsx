import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { divIcon, type Marker as LeafletMarker } from 'leaflet';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Button } from '../../../components/ui/Button';
import { formatTime } from '../../itinerary/domain/scheduling';
import { preferenceLabel } from '../../trips/utils/tripFormatters';
import { displayLongitude, viewportFor, type ItineraryMapMarker, type AccommodationMapMarker, type Location } from '../domain/mapData';
import { attributionHtml, tileConfig } from '../services/tileConfig';
import styles from './MapWorkspace.module.css';
import { RouteOverlays } from './RouteOverlays';
import type { RouteOverlay } from '../../transport/components/TransportProvider';

export type TripMapProps = { markers: ItineraryMapMarker[]; propertyMarkers?: AccommodationMapMarker[]; selectedId: string | null; onSelect: (id: string) => void; onDetails: (id: string) => void; fitRequest: number; focusRequest: number; routes?: RouteOverlay[]; selectedRouteId?: string | null; onRouteSelect?: (id: string) => void; routeFocusRequest?: number };

class MapBoundary extends Component<{ children: ReactNode }, { failed: boolean; attempt: number }> {
  state = { failed: false, attempt: 0 };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <div className={styles.mapEmpty} role="alert"><h3>Map initialization failed</h3><p>Your itinerary is still accessible in the list.</p><Button variant="secondary" onClick={() => this.setState(({ attempt }) => ({ failed: false, attempt: attempt + 1 }))}>Retry map</Button></div>;
    return <div key={this.state.attempt}>{this.props.children}</div>;
  }
}
function Viewport({ markers, selectedId, fitRequest, focusRequest }: { markers: { id: string; location: Location }[]; selectedId: string | null; fitRequest: number; focusRequest: number }) {
  const map = useMap();
  const bounds = useMemo(() => viewportFor(markers), [markers]);
  useEffect(() => {
    if (!bounds) return;
    map.invalidateSize({ animate: false });
    if (bounds.single) map.setView([bounds.south, bounds.west], 14, { animate: false });
    else map.fitBounds([[bounds.south, bounds.west], [bounds.north, bounds.east]], { padding: [40, 40], maxZoom: 15, animate: false });
  }, [map, bounds, fitRequest]);
  useEffect(() => {
    const marker = markers.find((marker) => marker.id === selectedId);
    if (marker && bounds) {
      map.invalidateSize({ animate: false });
      map.setView([marker.location.latitude, displayLongitude(marker.location.longitude, bounds.west)], Math.max(14, map.getZoom()), { animate: false });
    }
  }, [map, markers, bounds, selectedId, focusRequest]);
  useEffect(() => {
    const observer = new ResizeObserver(() => {
      if (map.getContainer().clientWidth && map.getContainer().clientHeight) map.invalidateSize({ animate: false });
    });
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);
  return null;
}
function ActivityMarker({ entry, selected, onSelect, onDetails, west, focusRequest }: { entry: ItineraryMapMarker; selected: boolean; onSelect: (id: string) => void; onDetails: (id: string) => void; west: number; focusRequest: number }) {
  const marker = useRef<LeafletMarker>(null);
  const icon = useMemo(() => divIcon({ className: `${styles.marker} ${selected ? styles.markerSelected : ''}`, html: `<span>${entry.dayNumber}.${entry.item.order + 1}</span>`, iconSize: [38, 38], iconAnchor: [19, 19] }), [entry.dayNumber, entry.item.order, selected]);
  const events = useMemo(() => ({ click: () => onSelect(entry.id) }), [entry.id, onSelect]);
  useEffect(() => { if (selected) marker.current?.openPopup(); else marker.current?.closePopup(); }, [selected, focusRequest]);
  useEffect(() => {
    const element = marker.current?.getElement();
    element?.setAttribute('aria-label', `Day ${entry.dayNumber} activity ${entry.item.order + 1}: ${entry.candidate.name}`);
    element?.setAttribute('aria-pressed', String(selected));
  }, [entry.dayNumber, entry.item.order, entry.candidate.name, selected]);
  return <Marker ref={marker} position={[entry.location.latitude, displayLongitude(entry.location.longitude, west)]} icon={icon} title={`Day ${entry.dayNumber} activity ${entry.item.order + 1}: ${entry.candidate.name}`} alt={`Select ${entry.candidate.name}`} keyboard eventHandlers={events} zIndexOffset={selected ? 1000 : 0}>
    <Popup autoPan={false}><div className={styles.popup}><strong>{entry.candidate.name}</strong><p>Day {entry.dayNumber} · Activity {entry.item.order + 1}</p><p>{entry.candidate.categories.map(preferenceLabel).join(' · ')} · Suggested {formatTime(entry.item.startMinute)}</p><p>{entry.item.endMinute - entry.item.startMinute} minutes{entry.item.durationAssumed ? ' (planning assumption)' : ' (source estimate)'}</p><p>{entry.candidate.source === 'fixture' ? 'Development fixture — not live place data' : entry.candidate.sourceName}</p><button type="button" onClick={() => onDetails(entry.id)}>View activity details</button></div></Popup>
  </Marker>;
}
function PropertyMarker({ entry, selected, onSelect, onDetails, west, focusRequest }: { entry: AccommodationMapMarker; selected: boolean; onSelect: (id: string) => void; onDetails: (id: string) => void; west: number; focusRequest: number }) {
  const marker = useRef<LeafletMarker>(null);
  const label = `${entry.planned ? 'Planned stay' : 'Discovered accommodation'}: ${entry.property.name}`;
  const icon = useMemo(() => divIcon({ className: `${styles.marker} ${styles.stayMarker} ${selected ? styles.markerSelected : ''}`, html: '<span>Stay</span>', iconSize: [46, 34], iconAnchor: [23, 17] }), [selected]);
  const events = useMemo(() => ({ click: () => onSelect(entry.id) }), [entry.id, onSelect]);
  useEffect(() => { if (selected) marker.current?.openPopup(); else marker.current?.closePopup(); }, [selected, focusRequest]);
  useEffect(() => { marker.current?.getElement()?.setAttribute('aria-label', label); marker.current?.getElement()?.setAttribute('aria-pressed', String(selected)); }, [label, selected]);
  return <Marker ref={marker} position={[entry.location.latitude, displayLongitude(entry.location.longitude, west)]} icon={icon} title={label} alt={label} keyboard eventHandlers={events} zIndexOffset={selected ? 1000 : 500}>
    <Popup autoPan={false}><div className={styles.popup}><strong>{entry.property.name}</strong><p>{entry.planned ? 'Planned stay' : 'Discovered property — not selected for the trip'}</p><p>Price unavailable · Availability not checked</p><p>Geoapify / OpenStreetMap</p><button type="button" onClick={() => onDetails(entry.id)}>View property details</button></div></Popup>
  </Marker>;
}
function MapSurface(props: TripMapProps) {
  const [retry, setRetry] = useState(0);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const failures = useRef(0);
  const events = useMemo(() => ({ loading: () => { failures.current = 0; setStatus('loading'); }, tileerror: () => { failures.current++; setStatus('error'); }, load: () => setStatus(failures.current ? 'error' : 'ready') }), []);
  const located = useMemo(() => [...props.markers, ...(props.propertyMarkers ?? [])], [props.markers, props.propertyMarkers]);
  const bounds = viewportFor(located)!;
  if (!tileConfig) return <div className={styles.mapEmpty} role="status"><h3>Map provider not configured</h3><p>Configure a permitted tile source and attribution. Your itinerary remains accessible.</p></div>;
  return <div className={styles.mapSurface}>
    <MapContainer className={styles.canvas} center={bounds.single ? [bounds.south, bounds.west] : undefined} zoom={bounds.single ? 14 : undefined} bounds={bounds.single ? undefined : [[bounds.south, bounds.west], [bounds.north, bounds.east]]} boundsOptions={{ padding: [40, 40], maxZoom: 15 }} minZoom={1} maxZoom={tileConfig.maxZoom} scrollWheelZoom={false} attributionControl zoomControl>
      <TileLayer key={retry} url={tileConfig.url} attribution={attributionHtml(tileConfig)} eventHandlers={events} maxZoom={tileConfig.maxZoom} keepBuffer={0} />
      <Viewport markers={located} selectedId={props.selectedId} fitRequest={props.fitRequest} focusRequest={props.focusRequest} />
      {props.routes && <RouteOverlays routes={props.routes} selectedId={props.selectedRouteId} onSelect={props.onRouteSelect} focusRequest={props.routeFocusRequest} />}
      {props.markers.map((entry) => <ActivityMarker key={entry.id} entry={entry} selected={entry.id === props.selectedId} onSelect={props.onSelect} onDetails={props.onDetails} west={bounds.west} focusRequest={props.focusRequest} />)}
      {props.propertyMarkers?.map((entry) => <PropertyMarker key={entry.id} entry={entry} selected={entry.id === props.selectedId} onSelect={props.onSelect} onDetails={props.onDetails} west={bounds.west} focusRequest={props.focusRequest} />)}
    </MapContainer>
    {status === 'loading' && <p role="status" className={styles.tileStatus}>Loading map…</p>}
    {status === 'error' && <div role="alert" className={styles.tileStatus}><strong>Map tiles temporarily unavailable</strong><p>Some or all tiles failed to load. Your itinerary and markers remain accessible.</p><Button variant="secondary" onClick={() => { failures.current = 0; setStatus('loading'); setRetry((value) => value + 1); }}>Retry tiles</Button></div>}
  </div>;
}
export function InteractiveTripMap(props: TripMapProps) {
  if (!props.markers.length && !props.propertyMarkers?.length) return <div className={styles.mapEmpty} role="status"><h3>No locations available for this filter yet.</h3><p>Activities without supplied valid coordinates remain in the list. No destination position is assumed.</p></div>;
  return <MapBoundary><MapSurface {...props} /></MapBoundary>;
}
