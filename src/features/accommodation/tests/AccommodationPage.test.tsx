import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appRoutes } from '../../../app/routes';
import { ThemeProvider } from '../../../app/providers/ThemeProvider';
import { TripsProvider } from '../../../app/providers/TripsProvider';
import { LocalStorageTripRepository, STORAGE_KEY } from '../../trips/services/LocalStorageTripRepository';
import { GeoapifyPlacesProvider } from '../../places/services/geoapifyProvider';
import { RequestClient } from '../../../shared/services/requestClient';
import { AccommodationDiscovery, accommodationRuntime } from '../services/accommodationService';
import { wikimediaMediaService } from '../../media/services/wikimediaMediaService';
import { collection, propertyFeature, response, stayTrip } from './testData';
import type { TripMapProps } from '../../map/components/InteractiveTripMap';

vi.mock('../../map/components/InteractiveTripMap', () => ({ InteractiveTripMap: (props: TripMapProps) => <section aria-label="Map test boundary" data-focus={props.focusRequest}>{props.markers.map((entry) => <button key={entry.id} aria-pressed={props.selectedId===entry.id} onClick={() => props.onSelect(entry.id)}>Activity marker {entry.candidate.name}</button>)}{props.propertyMarkers?.map((entry) => <button key={entry.id} aria-pressed={props.selectedId===entry.id} onClick={() => props.onSelect(entry.id)}>Property marker {entry.property.name}</button>)}</section> }));
const original = accommodationRuntime.discovery; let fetcher: ReturnType<typeof vi.fn<typeof fetch>>; let status = 200; let empty = false;
function mount(path = '/trips/test-trip/accommodation') {
  const router = createMemoryRouter(appRoutes,{initialEntries:[path]});
  render(<ThemeProvider><TripsProvider repository={new LocalStorageTripRepository(localStorage)}><RouterProvider router={router} /></TripsProvider></ThemeProvider>); return router;
}
async function search() { await screen.findByRole('heading',{name:'Find accommodation in Rome'}); await userEvent.click(screen.getByRole('button',{name:'Find accommodation'})); await screen.findByRole('button',{name:'Details for Test property hotel-a'}); }
beforeEach(() => {
  status=200;empty=false;localStorage.setItem(STORAGE_KEY,JSON.stringify({version:1,trips:[stayTrip,{...stayTrip,id:'other',destination:'Vienna',title:'Vienna trip',destinationResolution:undefined}]}));
  vi.stubGlobal('matchMedia', () => ({ matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn() }));
  Object.defineProperty(HTMLDialogElement.prototype,'showModal',{configurable:true,value:function(this:HTMLDialogElement){this.setAttribute('open','');}});
  Object.defineProperty(HTMLDialogElement.prototype,'close',{configurable:true,value:function(this:HTMLDialogElement){this.removeAttribute('open');}});
  fetcher=vi.fn<typeof fetch>().mockImplementation(async (input) => {
    if(status!==200) return response({},status); if(empty) return response(collection());
    const url=new URL(String(input)); if(url.pathname.includes('place-details')) return response(collection(propertyFeature(url.searchParams.get('id')!,{feature_type:'details'})));
    return response(collection(propertyFeature(),propertyFeature('hotel-b'),propertyFeature('apartment',{categories:['accommodation.apartment']})));
  });
  accommodationRuntime.discovery=new AccommodationDiscovery(new GeoapifyPlacesProvider('unit-test',new RequestClient(fetcher)));
  vi.spyOn(wikimediaMediaService,'resolve').mockResolvedValue(null);
});
afterEach(() => { cleanup();localStorage.clear();accommodationRuntime.discovery=original;vi.restoreAllMocks();vi.unstubAllGlobals(); });
describe('Accommodation workspace through real repository and provider adapter', () => {
  it('shows five nights and honest pricing/availability without another input for trip dates', async () => {
    mount(); await search(); expect(screen.getByText(/5 nights · 2 travelers/)).toBeVisible(); expect(screen.getByText(/Live accommodation prices are not available/)).toBeVisible(); expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
    expect(screen.getAllByRole('heading',{level:3})[0]).toHaveTextContent('hotel-a');
  });
  it('selects a property, persists after reloading, and displays it in Overview and the existing map', async () => {
    const router=mount(); await search(); await userEvent.click(screen.getByRole('button',{name:'Select Test property hotel-a'}));
    await screen.findByText('Test property hotel-a selected as your planned stay.');
    await act(async () => {await router.navigate('/trips/test-trip');}); expect(await screen.findByRole('region',{name:'Planned accommodation'})).toHaveTextContent('Test property hotel-a');
    await act(async () => {await router.navigate('/trips/test-trip/map?stay=geoapify-hotel-a');}); expect(await screen.findByRole('region',{name:'Selected map accommodation'})).toHaveTextContent('Test property hotel-a');
    expect(screen.getByRole('button',{name:'Property marker Test property hotel-a'})).toHaveAttribute('aria-pressed','true');
    cleanup(); mount(); await screen.findByRole('heading',{name:'Find accommodation in Rome'}); expect(screen.getByRole('region',{name:'Planned accommodation'})).toHaveTextContent('Test property hotel-a');
    expect((await new LocalStorageTripRepository(localStorage).get('other'))?.selectedStay).toBeUndefined();
  });
  it('replaces one primary selection and clears it without removing search results', async () => {
    mount();await search();await userEvent.click(screen.getByRole('button',{name:'Select Test property hotel-a'})); await screen.findByText(/hotel-a selected as your planned stay/);
    await userEvent.click(screen.getByRole('button',{name:'Select Test property hotel-b'})); await userEvent.click(within(screen.getByRole('dialog')).getByRole('button',{name:'Replace stay'}));
    await screen.findByText(/hotel-b selected as your planned stay/); expect(screen.getByRole('region',{name:'Planned accommodation'})).not.toHaveTextContent('hotel-a');
    await userEvent.click(screen.getByRole('button',{name:'Remove planned stay'})); await userEvent.click(within(screen.getByRole('dialog')).getByRole('button',{name:'Remove stay'})); await screen.findByText('Planned stay removed.');
    expect(screen.getByRole('button',{name:'Details for Test property hotel-a'})).toBeVisible(); expect((await new LocalStorageTripRepository(localStorage).get(stayTrip.id))?.selectedStay).toBeUndefined();
  });
  it('loads detail and media on demand, retains fallback, and keeps factual comparison fields', async () => {
    mount();await search();expect(wikimediaMediaService.resolve).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('checkbox',{name:'Compare Test property hotel-a'}));await userEvent.click(screen.getByRole('checkbox',{name:'Compare Test property hotel-b'})); expect(screen.getByRole('table')).toHaveTextContent('Not verified');
    await userEvent.click(screen.getByRole('button',{name:'Details for Test property hotel-a'})); await waitFor(() => expect(wikimediaMediaService.resolve).toHaveBeenCalled());
    const dialog=screen.getByRole('dialog'); expect(dialog).toHaveTextContent('No verified photograph available');expect(dialog).toHaveTextContent('Price unavailable'); expect(within(dialog).getByRole('link',{name:'Powered by Geoapify'})).toBeVisible();
  });
  it('performs debounced provider name/type queries without changing saved preferences', async () => {
    mount();await search();await userEvent.click(screen.getByRole('button',{name:'Hostels'}));
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));expect(new URL(String(fetcher.mock.calls[1]![0])).searchParams.get('categories')).toBe('accommodation.hostel');
    await userEvent.type(screen.getByRole('textbox',{name:'Property name'}),'Central');await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(3));expect(new URL(String(fetcher.mock.calls[2]![0])).searchParams.get('name')).toBe('Central');
    expect((await new LocalStorageTripRepository(localStorage).get(stayTrip.id))?.preferences?.accommodation).toBe('hotel');
  });
  it('focuses list-selected property markers and updates details when another marker is selected', async () => {
    mount();await search();await userEvent.click(screen.getByRole('button',{name:'View Test property hotel-a on map'}));
    expect(await screen.findByRole('button',{name:'Property marker Test property hotel-a'})).toHaveAttribute('aria-pressed','true');
    await userEvent.click(screen.getByRole('button',{name:'Property marker Test property hotel-b'})); expect(screen.getByRole('region',{name:'Focused accommodation'})).toHaveTextContent('Test property hotel-b');
    await userEvent.click(screen.getByRole('button',{name:'Property details'}));expect(screen.getByRole('dialog')).toHaveTextContent('Test property hotel-b');
  });
  it('distinguishes missing configuration, zero-night trips and empty results', async () => {
    accommodationRuntime.discovery=new AccommodationDiscovery(new GeoapifyPlacesProvider(''));mount(); await screen.findByRole('heading',{name:'Find accommodation in Rome'});expect(screen.getByText(/Accommodation search requires provider configuration/)).toBeVisible();expect(screen.getByRole('button',{name:'Find accommodation'})).toBeDisabled();cleanup();
    localStorage.setItem(STORAGE_KEY,JSON.stringify({version:1,trips:[{...stayTrip,endDate:stayTrip.startDate}]})); accommodationRuntime.discovery=new AccommodationDiscovery(new GeoapifyPlacesProvider('test',new RequestClient(fetcher)));mount();await search();expect(screen.getByRole('button',{name:'Select Test property hotel-a'})).toBeDisabled();
    cleanup(); empty=true;accommodationRuntime.discovery=new AccommodationDiscovery(new GeoapifyPlacesProvider('test',new RequestClient(fetcher)));mount();await screen.findByRole('heading',{name:'Find accommodation in Rome'});await userEvent.click(screen.getByRole('button',{name:'Find accommodation'}));expect(await screen.findByText(/No accommodation found in this search area/)).toBeVisible();
  });
  it('retains a saved selection on provider failure and clears results on trip switching', async () => {
    const router=mount();await search();await userEvent.click(screen.getByRole('button',{name:'Select Test property hotel-a'}));await screen.findByText(/hotel-a selected as your planned stay/);
    status=429;await userEvent.selectOptions(screen.getByLabelText('Search radius'),'10');expect(await screen.findByRole('alert')).toHaveTextContent('rate limiting');expect(screen.getByRole('region',{name:'Planned accommodation'})).toHaveTextContent('hotel-a');
    await act(async () => {await router.navigate('/trips/other/accommodation');});await screen.findByRole('heading',{name:'Find accommodation in Vienna'});expect(screen.queryByText('Test property hotel-a')).not.toBeInTheDocument();
  });
});
