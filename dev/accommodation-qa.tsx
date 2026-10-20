// Development-only visual test harness. Vite's production entry does not import this file.
// It uses an isolated session key and never writes the application's Trip storage key.
import { createRoot } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { appRoutes } from '../src/app/routes';
import { ThemeProvider } from '../src/app/providers/ThemeProvider';
import { TripsProvider } from '../src/app/providers/TripsProvider';
import { LocalStorageTripRepository } from '../src/features/trips/services/LocalStorageTripRepository';
import { AccommodationDiscovery, accommodationRuntime } from '../src/features/accommodation/services/accommodationService';
import { GeoapifyPlacesProvider } from '../src/features/places/services/geoapifyProvider';
import { RequestClient } from '../src/shared/services/requestClient';
import { stayTrip, propertyFeature, collection, response } from '../src/features/accommodation/tests/testData';
import { generateItinerary } from '../src/features/itinerary/domain/generator';
import { candidate, generationOptions } from '../src/features/itinerary/tests/testData';
import '../src/styles/global.css';

if (!import.meta.env.DEV) throw new Error('QA harness is development-only.');
const key='smart-travel-planner.qa.accommodation.v1';
const initial=JSON.stringify({version:1,trips:[{...stayTrip,itinerary:generateItinerary(stayTrip,[candidate('qa-landmark',{name:'QA itinerary location',location:{latitude:41.89,longitude:12.49}})],generationOptions)},{...stayTrip,id:'qa-second',title:'Vienna QA trip',destination:'Vienna',destinationResolution:undefined}]});
const storage={getItem:()=>sessionStorage.getItem(key)??initial,setItem:(_key:string,value:string)=>sessionStorage.setItem(key,value)} as Storage;
accommodationRuntime.discovery=new AccommodationDiscovery(new GeoapifyPlacesProvider('qa-placeholder',new RequestClient(async (input) => {
  const url=new URL(String(input)); const type=url.searchParams.get('categories'); const name=url.searchParams.get('name')?.toLowerCase()??'';
  const fixtures=[propertyFeature('hotel-a',{name:'QA Hotel Alpha',formatted:'Test address A — Rome',lat:41.899,lon:12.493}),propertyFeature('hotel-b',{name:'QA Hotel Beta',formatted:'Test address B — Rome',lat:41.897,lon:12.487}),propertyFeature('apartment',{name:'QA Apartment',categories:['accommodation.apartment'],formatted:'Test address C — Rome',lat:41.9,lon:12.491})];
  if(url.pathname.includes('place-details')) {const match=fixtures.find((f)=>f.properties.place_id===url.searchParams.get('id'));return response(collection(...(match?[{properties:{...match.properties,feature_type:'details'}}]:[])));}
  return response(collection(...fixtures.filter((f)=>(type==='accommodation'||f.properties.categories.includes(type!))&&f.properties.name.toLowerCase().includes(name))));
})));
const router=createMemoryRouter(appRoutes,{initialEntries:['/trips/test-trip/accommodation']});
createRoot(document.getElementById('root')!).render(<><div style={{position:'fixed',bottom:0,right:0,zIndex:3000,padding:'5px 12px',background:'var(--surface-primary)',border:'1px solid var(--border-strong)',color:'var(--text-primary)',fontSize:11,pointerEvents:'none'}}>QA ONLY · mocked provider records · isolated test storage</div><ThemeProvider><TripsProvider repository={new LocalStorageTripRepository(storage)}><RouterProvider router={router}/></TripsProvider></ThemeProvider></>);
