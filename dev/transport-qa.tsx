// Isolated visual QA only. Not imported by the production entry.
import { createRoot } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { appRoutes } from '../src/app/routes';
import { ThemeProvider } from '../src/app/providers/ThemeProvider';
import { TripsProvider } from '../src/app/providers/TripsProvider';
import { LocalStorageTripRepository } from '../src/features/trips/services/LocalStorageTripRepository';
import { GeoapifyPlacesProvider } from '../src/features/places/services/geoapifyProvider';
import { RequestClient } from '../src/shared/services/requestClient';
import { GeoapifyRoutingProvider, routingRuntime } from '../src/features/transport/services/routingProvider';
import { transportTrip, routeResponse } from '../src/features/transport/tests/testData';
import type { RouteRequest } from '../src/features/transport/domain/routing';
import '../src/styles/global.css';
if (!import.meta.env.DEV) throw new Error('QA only');
const key='smart-travel-planner.qa.transport.v1';
const initial=JSON.stringify({version:1,trips:[transportTrip,{...transportTrip,id:'other',title:'Other QA trip',itinerary:undefined,selectedStay:undefined}]});
const storage:Storage={length:1,key:()=>key,clear:()=>sessionStorage.removeItem(key),removeItem:()=>sessionStorage.removeItem(key),getItem:()=>sessionStorage.getItem(key)??initial,setItem:(_key,value)=>sessionStorage.setItem(key,value)};
routingRuntime.provider=new GeoapifyRoutingProvider(new GeoapifyPlacesProvider('qa-placeholder',new RequestClient(async(input)=>{
  const url=new URL(String(input));const points=url.searchParams.get('waypoints')!.split('|').map((value)=>{const [latitude,longitude]=value.split(',').map(Number);return {latitude:latitude!,longitude:longitude!};});
  return new Response(JSON.stringify(routeResponse({mode:url.searchParams.get('mode') as RouteRequest['mode'],points})));
})));
const router=createMemoryRouter(appRoutes,{initialEntries:['/trips/test-trip/transport']});
createRoot(document.getElementById('root')!).render(<ThemeProvider><div style={{position:'fixed',bottom:0,right:0,zIndex:3000,padding:8,background:'var(--surface-primary)',color:'var(--text-primary)',border:'1px solid var(--border-strong)',fontSize:11,pointerEvents:'none'}}>QA ONLY · synthetic routes, not live provider calculations · isolated storage</div><TripsProvider repository={new LocalStorageTripRepository(storage)}><RouterProvider router={router}/></TripsProvider></ThemeProvider>);
