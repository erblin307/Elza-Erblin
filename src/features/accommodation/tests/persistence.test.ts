import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LocalStorageTripRepository, STORAGE_KEY } from '../../trips/services/LocalStorageTripRepository';
import { createSelectedStay, stayNeedsReview } from '../domain/accommodation';
import { property, stayTrip } from './testData';
import { generateItinerary } from '../../itinerary/domain/generator';
import { candidate, generationOptions } from '../../itinerary/tests/testData';

const itinerary = generateItinerary(stayTrip,[candidate('a')],generationOptions);
beforeEach(() => localStorage.setItem(STORAGE_KEY,JSON.stringify({version:1,trips:[{...stayTrip,itinerary},{...stayTrip,id:'second'}]})));
afterEach(() => localStorage.clear());
describe('Stay persistence in the original Trip repository', () => {
  it('selects, reloads, replaces and removes one planned stay without changing itinerary or other trips', async () => {
    const repository = new LocalStorageTripRepository(localStorage);
    await repository.saveStay(stayTrip.id,createSelectedStay(stayTrip,property('a')));
    expect((await new LocalStorageTripRepository(localStorage).get(stayTrip.id))?.selectedStay?.property.providerId).toBe('a');
    await repository.saveStay(stayTrip.id,createSelectedStay(stayTrip,property('b')));
    expect((await repository.get(stayTrip.id))?.selectedStay?.property.providerId).toBe('b');
    expect((await repository.get('second'))?.selectedStay).toBeUndefined();
    await repository.saveStay(stayTrip.id,null);
    const trip = await repository.get(stayTrip.id); expect(trip?.selectedStay).toBeUndefined(); expect(trip?.itinerary).toEqual(itinerary); expect(trip?.budget).toEqual(stayTrip.budget);
  });
  it('rejects invalid identity, coordinates, owner and outdated date/occupancy snapshots', async () => {
    const repository = new LocalStorageTripRepository(localStorage); const stay = createSelectedStay(stayTrip,property());
    for (const invalid of [{...stay,tripId:'second'},{...stay,travelers:3},{...stay,checkIn:'2027-06-13'},{...stay,property:{...stay.property,providerId:'wrong'}}]) await expect(repository.saveStay(stayTrip.id,invalid)).rejects.toThrow();
    expect((await repository.get(stayTrip.id))?.selectedStay).toBeUndefined();
  });
  it('preserves a selected property when the trip changes and requires review', async () => {
    const repository = new LocalStorageTripRepository(localStorage); const stay = createSelectedStay(stayTrip,property()); await repository.saveStay(stayTrip.id,stay);
    await repository.update(stayTrip.id,{...stayTrip,travelers:3,endDate:'2027-06-18'});
    const updated = (await repository.get(stayTrip.id))!; expect(updated.selectedStay).toEqual(stay); expect(stayNeedsReview(updated)).toBe(true);
    await expect(repository.saveStay(stayTrip.id,stay)).rejects.toThrow('Trip details changed');
  });
  it('isolates malformed optional stay data and retains it until explicit replacement/removal', async () => {
    const raw = {version:1,trips:[{...stayTrip,selectedStay:{bad:'preserve'}}]}; localStorage.setItem(STORAGE_KEY,JSON.stringify(raw));
    const repository = new LocalStorageTripRepository(localStorage); expect((await repository.get(stayTrip.id))?.selectedStay).toBeUndefined(); expect(repository.getStayWarning(stayTrip.id)).toContain('preserved');
    await repository.update(stayTrip.id,{...stayTrip,budget:{...stayTrip.budget,amount:1600}});
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).trips[0].selectedStay).toEqual({bad:'preserve'});
    await repository.saveStay(stayTrip.id,null); expect(repository.getStayWarning(stayTrip.id)).toBeNull();
  });
  it('reports persistence failure and retains the previous valid selection', async () => {
    let data = localStorage.getItem(STORAGE_KEY); const storage: Storage = {get length() { return data === null ? 0 : 1; }, clear:() => {data=null;}, key:(index) => index===0 && data!==null ? STORAGE_KEY : null, removeItem:() => {data=null;}, getItem:() => data,setItem:(_key:string,value:string) => { if (data?.includes('selectedStay')) throw new Error('quota'); data=value; }};
    const repository = new LocalStorageTripRepository(storage); await repository.saveStay(stayTrip.id,createSelectedStay(stayTrip,property('first')));
    await expect(repository.saveStay(stayTrip.id,createSelectedStay(stayTrip,property('second')))).rejects.toThrow('could not be saved');
    expect((await repository.get(stayTrip.id))?.selectedStay?.property.providerId).toBe('first');
  });
});
