import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { StrictMode } from 'react';
import { Map as LeafletMap, Browser as LeafletBrowser } from 'leaflet';
import { normalizeRoute } from '../../transport/domain/routing';
import { request, routeResponse } from '../../transport/tests/testData';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateItinerary } from '../../itinerary/domain/generator';
import { candidate, generationOptions, testTrip } from '../../itinerary/tests/testData';
import { accommodationMarker, mapActivities, mapMarkers } from '../domain/mapData';
import { property } from '../../accommodation/tests/testData';
import { InteractiveTripMap, type TripMapProps } from '../components/InteractiveTripMap';
import { MapActivityList } from '../components/MapActivityList';

const tileEvents = vi.hoisted(() => ({ current: {} as Record<string, () => void> }));
vi.mock('react-leaflet', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-leaflet')>();
  return { ...actual, TileLayer: ({ eventHandlers }: { eventHandlers: Record<string, () => void> }) => { tileEvents.current = eventHandlers; return null; } };
});
let resize: (() => void) | undefined;
const disconnect = vi.fn();
beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { constructor(callback: () => void) { resize = callback; } observe() {} disconnect = disconnect; });
  disconnect.mockClear();
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const markers = mapMarkers(mapActivities(testTrip.id, generateItinerary(testTrip, [candidate('a', { location: { latitude: 41.89, longitude: 12.49 } }), candidate('b', { location: { latitude: 41.9, longitude: 12.48 } })], generationOptions)));
function props(overrides: Partial<TripMapProps> = {}): TripMapProps { return { markers, selectedId: null, onSelect: vi.fn(), onDetails: vi.fn(), fitRequest: 0, focusRequest: 0, ...overrides }; }
describe('Leaflet lifecycle and viewport integration (tile transport isolated)', () => {
  it('renders validated route geometry, synchronizes clicks and fits selected route bounds without replacing markers', () => {
    const svg = LeafletBrowser.svg; Object.defineProperty(LeafletBrowser,'svg',{configurable:true,value:true});
    try {
      const route=normalizeRoute(routeResponse(),request,new Date().toISOString());const onRouteSelect=vi.fn();const fit=vi.spyOn(LeafletMap.prototype,'fitBounds');
      const input=props({routes:[{id:'route-a',label:'A to B',route}],onRouteSelect});const mounted=render(<InteractiveTripMap {...input}/>);
      const path=mounted.container.querySelector('path.leaflet-interactive')!;expect(path).not.toBeNull();expect(path).toHaveAttribute('stroke','var(--text-secondary)');
      fireEvent.click(path);expect(onRouteSelect).toHaveBeenCalledWith('route-a');
      mounted.rerender(<InteractiveTripMap {...input} selectedRouteId="route-a" routeFocusRequest={1}/>);
      expect(path).toHaveAttribute('stroke','var(--accent-primary)');expect(fit).toHaveBeenLastCalledWith([[41.89,12.48],[41.9,12.49]],expect.objectContaining({animate:false}));
      expect(screen.getByTitle(/Day 1 activity 1:/)).toBeVisible();
      mounted.rerender(<InteractiveTripMap {...input} routes={[]}/>);expect(mounted.container.querySelector('path.leaflet-interactive')).toBeNull();
    } finally {cleanup();Object.defineProperty(LeafletBrowser,'svg',{configurable:true,value:svg});}
  });
  it('renders an accommodation marker in the same Leaflet surface and focuses its true coordinates', () => {
    const stay = accommodationMarker(property(),true); const onSelect=vi.fn(); const view=vi.spyOn(LeafletMap.prototype,'setView');
    const input=props({markers:[],propertyMarkers:[stay],onSelect}); const mounted=render(<InteractiveTripMap {...input} />);
    fireEvent.click(screen.getByRole('button',{name:'Planned stay: Test property hotel-a'})); expect(onSelect).toHaveBeenCalledWith(stay.id);
    mounted.rerender(<InteractiveTripMap {...input} selectedId={stay.id} focusRequest={1} />);
    expect(view).toHaveBeenLastCalledWith([stay.location.latitude,stay.location.longitude],expect.any(Number),expect.objectContaining({animate:false}));
    expect(screen.getByRole('button',{name:'Planned stay: Test property hotel-a'})).toHaveAttribute('aria-pressed','true'); expect(screen.getByText('View property details')).toBeVisible();
    mounted.rerender(<InteractiveTripMap {...input} propertyMarkers={[]} selectedId={null} />); expect(screen.getByText('No locations available for this filter yet.')).toBeVisible();
  });
  it('scrolls the selected list row relative to the panel viewport, not its offset parent', () => {
    const onSelect = vi.fn();
    const mounted = render(<MapActivityList activities={markers} selectedId={null} onSelect={onSelect} />);
    const list = screen.getByRole('list'); const row = screen.getAllByRole('listitem')[0]!;
    list.scrollTop = 50;
    vi.spyOn(list, 'getBoundingClientRect').mockReturnValue({ top: 100 } as DOMRect);
    vi.spyOn(row, 'getBoundingClientRect').mockReturnValue({ top: 200 } as DOMRect);
    const scroll = vi.fn(); Object.defineProperty(list, 'scrollTo', { configurable: true, value: scroll });
    mounted.rerender(<MapActivityList activities={markers} selectedId={markers[0]!.id} onSelect={onSelect} />);
    expect(scroll).toHaveBeenCalledWith({ top: 142, behavior: 'auto' });
  });
  it('does not initialize a guessed map for zero locations', () => {
    const fit = vi.spyOn(LeafletMap.prototype, 'fitBounds');
    render(<InteractiveTripMap {...props({ markers: [] })} />);
    expect(screen.getByText('No locations available for this filter yet.')).toBeVisible(); expect(fit).not.toHaveBeenCalled();
  });
  it('initially fits multiple markers and does not refit on unrelated selection renders', () => {
    const fit = vi.spyOn(LeafletMap.prototype, 'fitBounds');
    const view = vi.spyOn(LeafletMap.prototype, 'setView');
    const input = props(); const mounted = render(<InteractiveTripMap {...input} />);
    expect(fit).toHaveBeenCalledWith([[41.89, 12.48], [41.9, 12.49]], expect.objectContaining({ maxZoom: 15 }));
    const count = fit.mock.calls.length;
    mounted.rerender(<InteractiveTripMap {...input} selectedId={markers[0]!.id} focusRequest={1} />);
    expect(fit).toHaveBeenCalledTimes(count);
    expect(view).toHaveBeenLastCalledWith([41.89, 12.49], expect.any(Number), expect.objectContaining({ animate: false }));
    expect(screen.getByText('View activity details')).toBeVisible();
  });
  it('centers a single marker at a reasonable zoom and fit button requests refit', () => {
    const view = vi.spyOn(LeafletMap.prototype, 'setView');
    const input = props({ markers: [markers[0]!] }); const mounted = render(<InteractiveTripMap {...input} />);
    expect(view).toHaveBeenLastCalledWith([41.89, 12.49], 14, expect.objectContaining({ animate: false }));
    const count = view.mock.calls.length;
    mounted.rerender(<InteractiveTripMap {...input} fitRequest={1} />);
    expect(view.mock.calls.length).toBeGreaterThan(count);
  });
  it('maps marker click to its stable itinerary item and details action to the same item', () => {
    const input = props(); const mounted = render(<InteractiveTripMap {...input} />);
    fireEvent.click(screen.getByTitle(/Day 1 activity 1:/));
    expect(input.onSelect).toHaveBeenCalledWith(markers[0]!.id);
    mounted.rerender(<InteractiveTripMap {...input} selectedId={markers[0]!.id} />);
    fireEvent.click(screen.getByText('View activity details'));
    expect(input.onDetails).toHaveBeenCalledWith(markers[0]!.id);
  });
  it('differentiates loading from tile error and retry preserves marker access', () => {
    render(<InteractiveTripMap {...props()} />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading map');
    act(() => tileEvents.current.tileerror!());
    expect(screen.getByRole('alert')).toHaveTextContent('tiles temporarily unavailable');
    act(() => tileEvents.current.load!());
    expect(screen.getByRole('alert')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Retry tiles' }));
    act(() => tileEvents.current.load!());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByTitle(/Day 1 activity 1:/)).toBeVisible();
  });
  it('survives Strict Mode mount/cleanup and invalidates size without animation', () => {
    const invalidate = vi.spyOn(LeafletMap.prototype, 'invalidateSize');
    const mounted = render(<StrictMode><InteractiveTripMap {...props()} /></StrictMode>);
    const container = screen.getByTitle(/Day 1 activity 1:/).closest('.leaflet-container')!;
    Object.defineProperty(container, 'clientWidth', { configurable: true, value: 400 });
    Object.defineProperty(container, 'clientHeight', { configurable: true, value: 400 });
    act(() => resize?.());
    expect(invalidate).toHaveBeenCalledWith({ animate: false });
    mounted.unmount(); expect(disconnect).toHaveBeenCalled();
    render(<StrictMode><InteractiveTripMap {...props()} /></StrictMode>);
    expect(screen.getByTitle(/Day 1 activity 1:/)).toBeVisible();
  });
});
