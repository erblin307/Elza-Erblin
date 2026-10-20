import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Trip } from '../../trips/types/trip';
import { useTrips } from '../../../app/providers/TripsProvider';
import { planSegments, settingsFor, type RouteSegment } from '../domain/planner';
import { routeKey, routeLifetimeMs, type TransportSettings, type TravelRoute } from '../domain/routing';
import { routingRuntime } from '../services/routingProvider';

function useTransportState(trip: Trip) {
  const { saveTransportSettings } = useTrips();
  const settings = useMemo(() => settingsFor(trip), [trip]);
  const segments = useMemo(() => planSegments(trip, settings), [trip, settings]);
  const [routes, setRoutes] = useState<Record<string, TravelRoute>>({});
  const [failures, setFailures] = useState<Record<string, string>>({});
  const [attempted, setAttempted] = useState<Record<string, string>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusRequest, setFocusRequest] = useState(0);
  const [busy, setBusy] = useState(false); const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const active = useRef<AbortController | null>(null); const saveLock = useRef(false);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 15000); return () => clearInterval(timer); }, []);
  useEffect(() => () => { active.current?.abort(); active.current = null; }, [trip]);
  const currentRoute = (segment: RouteSegment, mode = segment.mode) => {
    if (!segment.request) return undefined;
    const route = routes[routeKey({ ...segment.request, mode })];
    return route && now - Date.parse(route.calculatedAt) < routeLifetimeMs ? route : undefined;
  };
  const status = (segment: RouteSegment) => segment.unavailable ?? (currentRoute(segment) ? 'Available · Geoapify estimate' : segment.key && failures[segment.key] ? failures[segment.key]! : attempted[segment.id] ? 'Stale or expired — calculate again for current endpoints and mode.' : 'Not calculated');
  const calculate = async (targets: RouteSegment[], compare = false) => {
    if (active.current || saveLock.current) return;
    const controller = new AbortController(); active.current = controller; setBusy(true); setError(null);
    try {
      for (const segment of targets) for (const mode of (compare ? ['walk', 'drive', 'bicycle'] as const : [segment.mode])) {
        if (!segment.request || controller.signal.aborted) continue;
        const request = { ...segment.request, mode }; const key = routeKey(request);
        if (routes[key] && Date.now() - Date.parse(routes[key].calculatedAt) < routeLifetimeMs) continue;
        setAttempted((prior) => ({ ...prior, [segment.id]: key }));
        try {
          const route = await routingRuntime.provider.getRoute(request, controller.signal);
          if (controller.signal.aborted) return;
          setNow(Date.now()); setRoutes((prior) => Object.fromEntries([...Object.entries(prior).filter(([oldKey, old]) => oldKey !== key && Date.now() - Date.parse(old.calculatedAt) < routeLifetimeMs).slice(-99), [key, route]]));
          setFailures((prior) => { const next = { ...prior }; delete next[key]; return next; });
        } catch (cause) {
          if (controller.signal.aborted) return;
          const message = cause instanceof Error ? cause.message : 'Route unavailable for the selected transportation mode.';
          setFailures((prior) => ({ ...prior, [key]: message }));
          // Shared rate limits/configuration errors should not trigger a request storm.
          if (cause && typeof cause === 'object' && 'code' in cause && ['rate-limit', 'configuration', 'auth'].includes(String(cause.code))) { setError(message); return; }
        }
      }
    } finally { if (active.current === controller) active.current = null; setBusy(false); }
  };
  const saveSettings = async (next: TransportSettings) => {
    if (saveLock.current || busy) return;
    saveLock.current = true; setSaving(true); setError(null);
    try { await saveTransportSettings(trip.id, next); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Transport preferences could not be saved.'); }
    finally { saveLock.current = false; setSaving(false); }
  };
  const selected = segments.find((segment) => segment.id === selectedId);
  const select = useCallback((id: string) => { setSelectedId(id); setFocusRequest((value) => value + 1); }, []);
  return { trip, settings, segments, selected, selectedId: selected?.id ?? null, focusRequest,
    select,
    currentRoute, status, calculate, saveSettings, busy: busy || saving, error, configured: routingRuntime.provider.configured };
}
type TransportContextValue = ReturnType<typeof useTransportState>;
const TransportContext = createContext<TransportContextValue | null>(null);
export function TransportProvider({ trip, children }: { trip: Trip; children: ReactNode }) {
  const value = useTransportState(trip); return <TransportContext.Provider value={value}>{children}</TransportContext.Provider>;
}
export function useTransport() { const value = useContext(TransportContext); if (!value) throw new Error('Transport requires the Trip Workspace.'); return value; }
export function useOptionalTransport() { return useContext(TransportContext); }
export type RouteOverlay = { id: string; label: string; route: TravelRoute };
export function useRouteOverlays(dayId = 'all'): RouteOverlay[] {
  const transport = useTransport();
  // The returned geometry is never synthesized from endpoints.
  return transport.segments.filter((segment) => dayId === 'all' || segment.dayId === dayId).flatMap((segment) => {
    const route = transport.currentRoute(segment); return route ? [{ id: segment.id, label: `${segment.from.name} → ${segment.to.name}`, route }] : [];
  });
}
