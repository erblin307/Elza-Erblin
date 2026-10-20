import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appRoutes } from '../../../app/routes';
import { ThemeProvider } from '../../../app/providers/ThemeProvider';
import { TripsProvider, useTrips } from '../../../app/providers/TripsProvider';
import { LocalStorageTripRepository, STORAGE_KEY } from '../../trips/services/LocalStorageTripRepository';
import { generateItinerary } from '../../itinerary/domain/generator';
import { editItinerary } from '../../itinerary/domain/editing';
import { candidate, generationOptions, testTrip } from '../../itinerary/tests/testData';
import type { TripMapProps } from '../components/InteractiveTripMap';

vi.mock('../components/InteractiveTripMap', () => ({ InteractiveTripMap: (props: TripMapProps) => <section aria-label="Test map rendering boundary" data-fit={props.fitRequest} data-focus={props.focusRequest}>{props.markers.map((entry) => <button key={entry.id} aria-pressed={props.selectedId === entry.id} onClick={() => props.onSelect(entry.id)}>Marker {entry.candidate.name}</button>)}</section> }));
const pool = [candidate('a', { name: 'First landmark', location: { latitude: 41.89, longitude: 12.49 } }), candidate('b', { name: 'Second landmark', location: { latitude: 41.9, longitude: 12.48 } }), candidate('c', { name: 'Unmapped exercise' })];
const first = { ...testTrip, itinerary: generateItinerary(testTrip, pool, generationOptions) };
const second = { ...testTrip, id: 'vienna', destination: 'Vienna', title: 'Vienna trip', itinerary: undefined };
function SavedPlanEditHarness() {
  const { trips, saveItinerary } = useTrips();
  return <button onClick={() => { const itinerary = trips.find((trip) => trip.id === first.id)!.itinerary!; void saveItinerary(first.id, editItinerary(itinerary, { type: 'remove', itemId: itinerary.days[0]!.items[0]!.id })); }}>Test persisted edit</button>;
}
function mount(path = '/trips/test-trip/map', editingHarness = false) {
  const router = createMemoryRouter(appRoutes, { initialEntries: [path] });
  render(<StrictMode><ThemeProvider><TripsProvider repository={new LocalStorageTripRepository(localStorage)}>{editingHarness && <SavedPlanEditHarness />}<RouterProvider router={router} /></TripsProvider></ThemeProvider></StrictMode>);
  return router;
}
beforeEach(() => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, trips: [first, second] }));
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function(this: HTMLDialogElement) { this.setAttribute('open', ''); } });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function(this: HTMLDialogElement) { this.removeAttribute('open'); } });
});
afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals(); });
describe('Trip map synchronization through existing routes and repository', () => {
  it('derives accurate coverage while keeping unmapped rows accessible', async () => {
    mount(); await screen.findByRole('heading', { name: 'Rome — Trip map' });
    expect(screen.getByText('3 days · 2 of 3 activities mapped in this filter')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: /^Select Unmapped/ }));
    expect(screen.getByRole('region', { name: 'Selected map activity' })).toHaveTextContent('Location unavailable');
    expect(screen.getAllByRole('button', { name: /^Marker/ })).toHaveLength(2);
  });
  it('shares one selection in both directions and clears it when filtering another day', async () => {
    mount(); await screen.findByRole('heading', { name: 'Rome — Trip map' });
    const row = screen.getByRole('button', { name: /^Select First landmark/ });
    await userEvent.click(row);
    expect(screen.getByRole('button', { name: 'Marker First landmark' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Marker Second landmark' }));
    expect(screen.getByRole('button', { name: /^Select Second landmark/ })).toHaveAttribute('aria-pressed', 'true');
    expect(row).toHaveAttribute('aria-pressed', 'false');
    await userEvent.selectOptions(screen.getByLabelText('Show itinerary day'), first.itinerary.days[0]!.id);
    expect(screen.queryByRole('region', { name: 'Selected map activity' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Marker/ })).toHaveLength(1);
    await userEvent.selectOptions(screen.getByLabelText('Show itinerary day'), 'all');
    expect(screen.getAllByRole('button', { name: /^Marker/ })).toHaveLength(2);
  });
  it('supports unmapped-only day and disables fitting without coordinates', async () => {
    mount(); await screen.findByRole('heading', { name: 'Rome — Trip map' });
    await userEvent.selectOptions(screen.getByLabelText('Show itinerary day'), first.itinerary.days[2]!.id);
    expect(screen.getByRole('button', { name: 'Fit locations' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /^Marker/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Select Unmapped/ })).toBeVisible();
  });
  it('fitting resets selection and details reuse real candidate metadata', async () => {
    mount(); await screen.findByRole('heading', { name: 'Rome — Trip map' });
    await userEvent.click(screen.getByRole('button', { name: /^Select First landmark/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Activity details' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('41.89, 12.49');
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close details' }));
    await userEvent.click(screen.getByRole('button', { name: 'Fit locations' }));
    expect(screen.queryByRole('region', { name: 'Selected map activity' })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Test map rendering boundary' })).toHaveAttribute('data-fit', '1');
  });
  it('deep-links from map to the correct itinerary day and activity and back', async () => {
    mount('/trips/test-trip/map?item=item-1'); await screen.findByRole('heading', { name: 'Rome — Trip map' });
    expect(screen.getByRole('region', { name: 'Selected map activity' })).toHaveTextContent('Second landmark');
    await userEvent.click(screen.getByRole('link', { name: 'View in itinerary' }));
    expect(await screen.findByRole('region', { name: 'Day 2 schedule' })).toHaveTextContent('Second landmark');
    await userEvent.click(screen.getByRole('link', { name: 'View on map' }));
    expect(await screen.findByRole('region', { name: 'Selected map activity' })).toHaveTextContent('Second landmark');
  });
  it('reflects actual persisted removal without reload and clears stale selection', async () => {
    mount('/trips/test-trip/map?item=item-0'); await screen.findByRole('heading', { name: 'Rome — Trip map' });
    await userEvent.click(screen.getByRole('link', { name: 'View in itinerary' }));
    await screen.findByRole('region', { name: 'Day 1 schedule' });
    await userEvent.click(screen.getByText('Actions', { exact: true }));
    await userEvent.click(screen.getByRole('button', { name: 'Remove activity' }));
    await userEvent.click(screen.getByRole('link', { name: 'Map' }));
    await screen.findByRole('heading', { name: 'Rome — Trip map' });
    expect(screen.queryByRole('button', { name: 'Marker First landmark' })).not.toBeInTheDocument();
    expect(screen.getByText('3 days · 1 of 2 activities mapped in this filter')).toBeVisible();
    cleanup(); mount(); await screen.findByRole('heading', { name: 'Rome — Trip map' });
    expect(screen.queryByRole('button', { name: 'Marker First landmark' })).not.toBeInTheDocument();
  });
  it('resets trip-scoped selection and never leaks markers into another trip', async () => {
    const router = mount(); await screen.findByRole('heading', { name: 'Rome — Trip map' });
    await userEvent.click(screen.getByRole('button', { name: 'Marker First landmark' }));
    await act(async () => { await router.navigate('/trips/vienna/map'); });
    await screen.findByRole('heading', { name: 'Vienna — Trip map' });
    expect(screen.getByRole('heading', { name: 'No saved itinerary yet' })).toBeVisible();
    expect(screen.queryByRole('region', { name: 'Selected map activity' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Marker/ })).not.toBeInTheDocument();
  });
  it('clears removed selection and updates markers while the same map page stays mounted', async () => {
    mount('/trips/test-trip/map?item=item-0', true); await screen.findByRole('heading', { name: 'Rome — Trip map' });
    expect(screen.getByRole('region', { name: 'Selected map activity' })).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Test persisted edit' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Marker First landmark' })).not.toBeInTheDocument());
    expect(screen.queryByRole('region', { name: 'Selected map activity' })).not.toBeInTheDocument();
  });
  it('retains selection and filtering across List/Map view controls', async () => {
    mount(); await screen.findByRole('heading', { name: 'Rome — Trip map' });
    // jsdom does not evaluate responsive media queries; expose the mobile controls
    // here to test their state contract. Real breakpoint visibility is browser QA.
    screen.getByText('List').closest<HTMLElement>('[role="group"]')!.style.display = 'flex';
    await userEvent.selectOptions(screen.getByLabelText('Show itinerary day'), first.itinerary.days[0]!.id);
    await userEvent.click(screen.getByRole('button', { name: 'List' }));
    await userEvent.click(screen.getByRole('button', { name: /^Select First landmark/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Map' }));
    expect(screen.getByRole('button', { name: 'Marker First landmark' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('Show itinerary day')).toHaveValue(first.itinerary.days[0]!.id);
  });
  it('labels preserved stale geographic data instead of claiming it belongs to the new destination', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, trips: [{ ...first, destination: 'Vienna' }] }));
    mount(); await screen.findByRole('heading', { name: 'Vienna — Trip map' });
    expect(screen.getByRole('status')).toHaveTextContent('preserved, outdated itinerary');
  });
  it('isolates two independent itineraries with different geographic coordinates', async () => {
    const vienna = { ...second, itinerary: generateItinerary(second, [candidate('vienna-location', { name: 'Vienna test landmark', destination: 'vienna', location: { latitude: 48.208427, longitude: 16.373256 } })], generationOptions) };
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, trips: [first, vienna] }));
    const router = mount(); await screen.findByRole('heading', { name: 'Rome — Trip map' });
    await act(async () => { await router.navigate('/trips/vienna/map'); });
    await screen.findByRole('heading', { name: 'Vienna — Trip map' });
    expect(screen.getByRole('button', { name: 'Marker Vienna test landmark' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Marker First landmark' })).not.toBeInTheDocument();
  });
});
