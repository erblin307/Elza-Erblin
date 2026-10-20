import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appRoutes } from '../../../app/routes';
import { ThemeProvider } from '../../../app/providers/ThemeProvider';
import { TripsProvider } from '../../../app/providers/TripsProvider';
import { LocalStorageTripRepository, STORAGE_KEY } from '../../trips/services/LocalStorageTripRepository';
import { testTrip } from '../../itinerary/tests/testData';
import { placesRuntime } from '../services/placesService';
import { GeoapifyPlacesProvider } from '../services/geoapifyProvider';
import { RequestClient } from '../../../shared/services/requestClient';
import { collection, feature, response } from './testData';
import type { TravelImage } from '../../media/domain/travelImage';

const original = placesRuntime.live;
let fetcher: ReturnType<typeof vi.fn<typeof fetch>>;
let failureStatus = 0;
function mount(path = '/trips/test-trip/places') {
  const router = createMemoryRouter(appRoutes, { initialEntries: [path] });
  render(<ThemeProvider><TripsProvider repository={new LocalStorageTripRepository(localStorage)}><RouterProvider router={router} /></TripsProvider></ThemeProvider>); return router;
}
async function resolveAndSearch() {
  await screen.findByRole('heading', { name: 'Places in Rome' });
  await userEvent.click(screen.getByRole('button', { name: 'Find destination matches' }));
  await screen.findByRole('radio', { name: /Rome, Italy/ });
  expect(screen.getByRole('button', { name: 'Confirm destination' })).toBeDisabled();
  await userEvent.click(screen.getByRole('radio', { name: /Rome, Italy/ }));
  await userEvent.click(screen.getByRole('button', { name: 'Confirm destination' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Search places' })).toBeEnabled());
  await userEvent.click(screen.getByRole('button', { name: 'Search places' }));
  await screen.findByRole('button', { name: 'Details for Colosseum' });
}
beforeEach(() => {
  failureStatus = 0; localStorage.clear(); localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, trips: [testTrip, { ...testTrip, id: 'vienna', destination: 'Vienna', title: 'Vienna trip' }] }));
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function(this: HTMLDialogElement) { this.setAttribute('open', ''); } });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function(this: HTMLDialogElement) { this.removeAttribute('open'); } });
  fetcher = vi.fn<typeof fetch>().mockImplementation(async (input) => {
    if (failureStatus) return response({}, failureStatus);
    const url = new URL(String(input));
    if (url.pathname.includes('geocode')) return response(collection(feature('rome-city', { formatted: 'Rome, Italy' }), feature('other-rome', { formatted: 'Rome, USA' })));
    if (url.pathname.includes('place-details')) return response(collection(feature(undefined, { feature_type: 'details' })));
    return response(collection(feature()));
  });
  placesRuntime.live = new GeoapifyPlacesProvider('unit-test-key', new RequestClient(fetcher));
  vi.spyOn(placesRuntime.media, 'resolve').mockResolvedValue(null);
});
afterEach(() => { cleanup(); placesRuntime.live = original; vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe('Places workspace with actual Geoapify adapter and mocked external responses', () => {
  it('requires provider configuration without inventing live results', async () => {
    placesRuntime.live = new GeoapifyPlacesProvider(''); mount();
    await screen.findByRole('heading', { name: 'Places in Rome' });
    expect(await screen.findByRole('status')).toHaveTextContent('requires provider configuration'); expect(fetcher).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Search places' })).toBeDisabled();
  });
  it('requires explicit destination choice, searches real endpoints and exposes source attribution', async () => {
    mount(); await resolveAndSearch();
    expect(fetcher).toHaveBeenCalledTimes(2); expect(screen.getByRole('link', { name: 'Powered by Geoapify' })).toBeVisible();
    expect((await new LocalStorageTripRepository(localStorage).get(testTrip.id))?.destinationResolution?.providerId).toBe('rome-city');
  });
  it('adds provider data to Day 2 and links to the existing itinerary/map after reload', async () => {
    const router = mount(); await resolveAndSearch();
    await userEvent.click(screen.getByRole('button', { name: 'Add Colosseum to itinerary' }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('Price information unavailable'); expect(dialog).toHaveTextContent('Opening hours not verified');
    await userEvent.selectOptions(within(dialog).getByLabelText('Itinerary day'), 'day-2027-06-13');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add activity' }));
    await screen.findByRole('button', { name: 'Already planned' });
    const repository = new LocalStorageTripRepository(localStorage); const stored = (await repository.get(testTrip.id))!;
    expect(stored.itinerary?.days[1]!.items).toHaveLength(1); expect(stored.itinerary?.catalog[0]?.providerId).toBe('place-colosseum'); expect((await repository.get('vienna'))?.itinerary).toBeUndefined();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Close place details' }));
    await act(async () => { await router.navigate('/trips/test-trip/itinerary?day=day-2027-06-13'); });
    expect(await screen.findByRole('region', { name: 'Day 2 schedule' })).toHaveTextContent('Colosseum');
    cleanup(); mount('/trips/test-trip/itinerary?day=day-2027-06-13'); expect(await screen.findByRole('region', { name: 'Day 2 schedule' })).toHaveTextContent('Colosseum');
  });
  it('debounces new category/name queries with documented server filtering', async () => {
    mount(); await resolveAndSearch(); await userEvent.click(screen.getByRole('button', { name: 'Museums' }));
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(3));
    expect(new URL(fetcher.mock.calls[2]![0] as string).searchParams.get('categories')).toBe('entertainment.museum');
    await userEvent.type(screen.getByLabelText('Search place names'), 'Forum'); await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(4));
    expect(new URL(fetcher.mock.calls[3]![0] as string).searchParams.get('name')).toBe('Forum');
  });
  it('retains selected place when photo lookup fails and shows neutral imagery', async () => {
    mount(); await resolveAndSearch(); await userEvent.click(screen.getByRole('button', { name: 'Details for Colosseum' }));
    await waitFor(() => expect(screen.queryByText('Loading place details and checking identity-linked media…')).not.toBeInTheDocument());
    expect(screen.getByRole('dialog')).toHaveTextContent('No verified photograph available'); expect(screen.getByRole('dialog')).toHaveTextContent('Colosseum');
  });
  it('displays and persists properly attributed identity-matched imagery when available', async () => {
    const image: TravelImage = { url: 'https://upload.wikimedia.org/test/Colosseum.jpg', alt: 'Colosseum photograph', source: 'wikimedia', entityId: 'Q10285', fileTitle: 'File:Colosseum.jpg', attribution: { author: 'Unit-test photographer', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Colosseum.jpg' } };
    vi.mocked(placesRuntime.media.resolve).mockResolvedValue(image);
    mount(); await resolveAndSearch(); await userEvent.click(screen.getByRole('button', { name: 'Details for Colosseum' }));
    const dialog = screen.getByRole('dialog'); await within(dialog).findByRole('link', { name: 'CC BY-SA 4.0' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add activity' }));
    await waitFor(async () => expect((await new LocalStorageTripRepository(localStorage).get(testTrip.id))?.itinerary?.catalog[0]?.place?.image).toEqual(image));
  });
  it('handles provider authentication/rate failures without crashing or removing saved trips', async () => {
    failureStatus = 429; mount(); await screen.findByRole('heading', { name: 'Places in Rome' });
    await userEvent.click(screen.getByRole('button', { name: 'Find destination matches' })); expect(await screen.findByRole('alert')).toHaveTextContent('rate limiting');
    expect((await new LocalStorageTripRepository(localStorage).get(testTrip.id))?.destination).toBe('Rome');
  });
  it('clears discovery results when switching to another trip', async () => {
    const router = mount(); await resolveAndSearch(); await act(async () => { await router.navigate('/trips/vienna/places'); });
    await screen.findByRole('heading', { name: 'Places in Vienna' }); expect(screen.queryByRole('button', { name: 'Details for Colosseum' })).not.toBeInTheDocument();
  });
});
