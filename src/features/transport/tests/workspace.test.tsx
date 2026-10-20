import { act, cleanup, configure, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appRoutes } from '../../../app/routes';
import { ThemeProvider } from '../../../app/providers/ThemeProvider';
import { TripsProvider } from '../../../app/providers/TripsProvider';
import { LocalStorageTripRepository, STORAGE_KEY } from '../../trips/services/LocalStorageTripRepository';
import { GeoapifyPlacesProvider } from '../../places/services/geoapifyProvider';
import { RequestClient } from '../../../shared/services/requestClient';
import { GeoapifyRoutingProvider, routingRuntime } from '../services/routingProvider';
import { routeResponse, transportTrip } from './testData';
import { settingsFor } from '../domain/planner';
import type { RouteRequest } from '../domain/routing';
import type { TripMapProps } from '../../map/components/InteractiveTripMap';

vi.mock('../../map/components/InteractiveTripMap', () => ({ InteractiveTripMap: (props: TripMapProps) => <section aria-label="Routing map test boundary">{props.routes?.map((route) => <button key={route.id} aria-pressed={props.selectedRouteId===route.id} onClick={() => props.onRouteSelect?.(route.id)}>Route overlay {route.label}</button>)}</section> }));
const original=routingRuntime.provider;let fetcher:ReturnType<typeof vi.fn<typeof fetch>>;
beforeEach(() => {
  configure({ asyncUtilTimeout: 5000 });
  localStorage.setItem(STORAGE_KEY,JSON.stringify({version:1,trips:[transportTrip,{...transportTrip,id:'other',title:'Other trip',itinerary:undefined,selectedStay:undefined}]}));
  vi.stubGlobal('matchMedia',()=>({matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()}));
  fetcher=vi.fn<typeof fetch>().mockImplementation(async(input)=>{const url=new URL(String(input));const points=url.searchParams.get('waypoints')!.split('|').map((text)=>{const [latitude,longitude]=text.split(',').map(Number);return {latitude:latitude!,longitude:longitude!};});return new Response(JSON.stringify(routeResponse({mode:url.searchParams.get('mode') as RouteRequest['mode'],points})));});
  routingRuntime.provider=new GeoapifyRoutingProvider(new GeoapifyPlacesProvider('test',new RequestClient(fetcher)));
});
afterEach(()=>{cleanup();configure({asyncUtilTimeout:1000});localStorage.clear();routingRuntime.provider=original;vi.restoreAllMocks();vi.unstubAllGlobals();});
function mount(path='/trips/test-trip/transport') {const router=createMemoryRouter(appRoutes,{initialEntries:[path]});render(<ThemeProvider><TripsProvider repository={new LocalStorageTripRepository(localStorage)}><RouterProvider router={router}/></TripsProvider></ThemeProvider>);return router;}
async function calculate() {await screen.findByRole('heading',{name:'Rome · Local transportation'});await userEvent.click(screen.getByRole('button',{name:'Calculate day routes'}));await waitFor(()=>expect(screen.getByLabelText('Daily travel summary')).toHaveTextContent('1 of 1'));}
describe('Transport workspace and original persistence',()=>{
  it('calculates provider metrics, shows a conflict, compares real requests and synchronizes map/timeline selection',async()=>{
    const router=mount();await calculate();expect(fetcher).toHaveBeenCalledTimes(1);expect(screen.getByText('The current schedule may not allow enough travel time between these activities.')).toBeVisible();
    await userEvent.click(screen.getByRole('button',{name:'Compare modes'}));await waitFor(()=>expect(fetcher).toHaveBeenCalledTimes(3));await waitFor(()=>expect(screen.getByRole('button',{name:'Calculate day routes'})).toBeEnabled());
    expect(new Set(fetcher.mock.calls.map(([input])=>new URL(String(input)).searchParams.get('mode')))).toEqual(new Set(['walk','drive','bicycle']));
    await userEvent.click(screen.getByRole('button',{name:'Map'}));expect(await screen.findByRole('button',{name:/Route overlay/})).toHaveAttribute('aria-pressed','true');
    await act(async()=>{await router.navigate('/trips/test-trip/itinerary');});expect(await screen.findByRole('link',{name:/Test activity .* → Test activity/})).toBeVisible();expect(screen.getByText(/Selected connection/)).toBeVisible();
    await act(async()=>{await router.navigate('/trips/test-trip/map');});expect(await screen.findByRole('button',{name:/Route overlay/})).toHaveAttribute('aria-pressed','true');
  },15000);
  it('persists mode settings but never relabels walking data or persists geometry',async()=>{
    mount();await calculate();await userEvent.selectOptions(screen.getByLabelText('Default local mode'),'drive');
    await waitFor(()=>expect(screen.getByLabelText('Daily travel summary')).toHaveTextContent('0 of 1'));expect(screen.getByText(/Stale or expired/)).toBeVisible();
    const stored=await new LocalStorageTripRepository(localStorage).get(transportTrip.id);expect(stored?.transportSettings?.defaultMode).toBe('drive');expect(stored?.preferences?.transportation).toEqual(['walking']);expect(stored?.itinerary).toEqual(transportTrip.itinerary);expect(localStorage.getItem(STORAGE_KEY)).not.toContain('MultiLineString');
    cleanup();mount();await screen.findByRole('heading',{name:'Rome · Local transportation'});expect(screen.getByLabelText('Default local mode')).toHaveValue('drive');expect(screen.getByLabelText('Daily travel summary')).toHaveTextContent('0 of 1');
  },15000);
  it('keeps per-connection overrides independent and adds optional hotel transitions',async()=>{
    mount();await screen.findByRole('heading',{name:'Rome · Local transportation'});await userEvent.click(screen.getByLabelText('Start at planned stay'));await waitFor(()=>expect(screen.getByLabelText('Daily travel summary')).toHaveTextContent('0 of 2'));
    const list=screen.getByRole('list',{name:'Travel connections'});const modes=within(list).getAllByRole('combobox');await userEvent.selectOptions(modes[0]!,'bicycle');await waitFor(()=>expect(modes[0]).toHaveValue('bicycle'));expect(modes[1]).toHaveValue('walk');
    await userEvent.click(screen.getByLabelText('Return to planned stay'));await waitFor(()=>expect(screen.getByLabelText('Daily travel summary')).toHaveTextContent('0 of 3'));
  });
  it('handles missing configuration and rate limits without invented routes',async()=>{
    routingRuntime.provider=new GeoapifyRoutingProvider(new GeoapifyPlacesProvider(''));mount();expect(await screen.findByText(/Routing requires Geoapify configuration/)).toBeVisible();expect(screen.getByRole('button',{name:'Calculate day routes'})).toBeDisabled();cleanup();
    fetcher.mockResolvedValue(new Response('{}',{status:429}));routingRuntime.provider=new GeoapifyRoutingProvider(new GeoapifyPlacesProvider('test',new RequestClient(fetcher)));mount();await screen.findByRole('heading',{name:'Rome · Local transportation'});await userEvent.click(screen.getByRole('button',{name:'Calculate day routes'}));expect(await screen.findByRole('alert')).toHaveTextContent('rate limiting');expect(screen.getByLabelText('Daily travel summary')).toHaveTextContent('0 of 1');
  });
  it('isolates trips and restores the same preferences through repository reload',async()=>{
    const repository=new LocalStorageTripRepository(localStorage);await repository.saveTransportSettings(transportTrip.id,{...settingsFor(transportTrip),defaultMode:'bicycle'});expect((await new LocalStorageTripRepository(localStorage).get(transportTrip.id))?.transportSettings?.defaultMode).toBe('bicycle');expect((await repository.get('other'))?.transportSettings).toBeUndefined();
    const router=mount();await calculate();await act(async()=>{await router.navigate('/trips/other/transport');});expect(await screen.findByText(/Create an/)).toBeVisible();expect(screen.queryByLabelText('Daily travel summary')).not.toBeInTheDocument();
  });
  it('preserves malformed optional settings during unrelated updates',async()=>{
    localStorage.setItem(STORAGE_KEY,JSON.stringify({version:1,trips:[{...transportTrip,transportSettings:{bad:'preserve'}}]}));const repository=new LocalStorageTripRepository(localStorage);expect((await repository.get(transportTrip.id))?.transportSettings).toBeUndefined();await repository.update(transportTrip.id,{...transportTrip,travelers:3});expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).trips[0].transportSettings).toEqual({bad:'preserve'});
  });
});
