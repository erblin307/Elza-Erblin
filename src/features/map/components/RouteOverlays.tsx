import { useEffect } from 'react';
import { Polyline, Popup, useMap } from 'react-leaflet';
import type { RouteOverlay } from '../../transport/components/TransportProvider';
import { formatDistance, formatDuration, leafletLines, modeLabels } from '../../transport/domain/routing';
import { displayLongitude, viewportFor } from '../domain/mapData';
import styles from './MapWorkspace.module.css';

export function RouteOverlays({ routes, selectedId, onSelect, focusRequest }: { routes: RouteOverlay[]; selectedId?: string | null; onSelect?: (id: string) => void; focusRequest?: number }) {
  const map = useMap(); const selected = routes.find((entry) => entry.id === selectedId);
  const selectedRoute = selected?.route;
  useEffect(() => {
    if (!selectedRoute) return;
    const bounds = viewportFor(leafletLines(selectedRoute.geometry).flat().map(([latitude, longitude]) => ({ location: { latitude, longitude } })))!;
    map.invalidateSize({ animate: false });
    map.fitBounds([[bounds.south, bounds.west], [bounds.north, bounds.east]], { padding: [40, 40], maxZoom: 16, animate: false });
  }, [map, selectedRoute, selectedId, focusRequest]);
  return <>{routes.map((entry) => {
    const lines = leafletLines(entry.route.geometry);
    const bounds = viewportFor(lines.flat().map(([latitude, longitude]) => ({ location: { latitude, longitude } })))!;
    const positions = lines.map((line) => line.map(([lat, lon]): [number, number] => [lat, displayLongitude(lon, bounds.west)]));
    return <Polyline key={entry.id} positions={positions} pathOptions={{ color: entry.id === selectedId ? 'var(--accent-primary)' : 'var(--text-secondary)', weight: entry.id === selectedId ? 5 : 3, opacity: 0.9 }} eventHandlers={{ click: () => onSelect?.(entry.id) }}>
      <Popup><div className={styles.popup}><strong>{entry.label}</strong><p>{modeLabels[entry.route.request.mode]} · {formatDistance(entry.route.distanceMeters)} · {formatDuration(entry.route.estimatedDurationSeconds)} estimated</p><p>Geoapify / OpenStreetMap · Not live traffic</p><button onClick={() => onSelect?.(entry.id)}>Select travel connection</button></div></Popup>
    </Polyline>;
  })}</>;
}
