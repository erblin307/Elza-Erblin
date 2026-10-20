import { afterEach, describe, expect, it, vi } from 'vitest';
import { normalizeAccommodations, createSelectedStay, stayNeedsReview } from '../domain/accommodation';
import { rankAccommodation, scoreAccommodation } from '../domain/scoring';
import { accommodationCost } from '../services/inventoryProvider';
import { AccommodationDiscovery } from '../services/accommodationService';
import { GeoapifyPlacesProvider } from '../../places/services/geoapifyProvider';
import { RequestClient } from '../../../shared/services/requestClient';
import { wikimediaMediaService } from '../../media/services/wikimediaMediaService';
import { property, propertyFeature, collection, resolution, response, stayTrip, timestamp } from './testData';
import { selectedStayMarker } from '../../map/domain/mapData';

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });
describe('Accommodation normalization and deterministic recommendations', () => {
  it('preserves identity and typed categories without invented prices, ratings or amenities', () => {
    const p = property(); expect(p.id).toBe(`geoapify-${p.providerId}`); expect(p.types).toEqual(['hotel']);
    expect(p).not.toHaveProperty('price'); expect(p).not.toHaveProperty('rating'); expect(p).not.toHaveProperty('amenities');
    expect(accommodationCost(createSelectedStay(stayTrip, p))).toMatchObject({status:'unknown',propertyId:p.id});
  });
  it.each([{name:''}, {name:undefined}, {lat:91}, {lon:181}, {lat:'41.9'}, {place_id:'bad/id'}, {categories:['catering.cafe']}])('rejects malformed property %j independently', (changes) => {
    const result = normalizeAccommodations(collection(propertyFeature('bad', changes), propertyFeature('good')), resolution.providerId, timestamp);
    expect(result.properties.map((p) => p.providerId)).toEqual(['good']); expect(result.rejectedCount).toBe(1);
  });
  it('handles missing optional metadata and excludes unsafe URLs', () => {
    const p = property('missing', { formatted:undefined, website:'javascript:alert(1)' }); expect(p.place.address).toBeUndefined(); expect(p.place.website).toBeUndefined();
  });
  it('merges the same provider entity across types but retains equal names at distinct IDs', () => {
    const result = normalizeAccommodations(collection(propertyFeature('same'), propertyFeature('same', {categories:['accommodation.apartment']}), propertyFeature('different',{name:'Test property same'})), resolution.providerId, timestamp);
    expect(result.properties).toHaveLength(2); expect(result.properties.find((p) => p.providerId === 'same')?.types).toEqual(['hotel','apartment']);
  });
  it('quarantines conflicting coordinates across all duplicates', () => {
    expect(normalizeAccommodations(collection(propertyFeature(), propertyFeature('hotel-a',{lat:42}), propertyFeature()), resolution.providerId, timestamp).properties).toHaveLength(0);
  });
  it('distinguishes empty from malformed provider responses', () => {
    expect(normalizeAccommodations(collection(), resolution.providerId, timestamp).properties).toEqual([]);
    expect(() => normalizeAccommodations({}, resolution.providerId, timestamp)).toThrow('invalid response');
  });
  it('prioritizes hotel or apartment preference with stable-ID ties and no unknown-price quality score', () => {
    const hotel = property('hotel'); const apartment = property('apartment',{categories:['accommodation.apartment']});
    expect(rankAccommodation([apartment,hotel],stayTrip,resolution.location,5)[0]?.property.id).toBe(hotel.id);
    expect(rankAccommodation([hotel,apartment],{...stayTrip,preferences:{...stayTrip.preferences!,accommodation:'apartment'}},resolution.location,5)[0]?.property.id).toBe(apartment.id);
    const score = scoreAccommodation(hotel,stayTrip,resolution.location,5); expect(Object.keys(score.factors)).toEqual(['preferredType','proximity']);
    expect(rankAccommodation([property('z'),property('a'),property('a')],stayTrip,resolution.location,5).map((entry) => entry.property.providerId)).toEqual(['a','z']);
  });
  it('filters by actual radius and derives a distinct planned map marker', () => {
    expect(rankAccommodation([property('near'),property('far',{lat:48,lon:16})],stayTrip,resolution.location,5)).toHaveLength(1);
    const stay = createSelectedStay(stayTrip,property()); const marker = selectedStayMarker(stayTrip.id,stay)!;
    expect(marker.kind).toBe('accommodation'); expect(marker.location).toEqual(stay.property.location); expect(marker.planned).toBe(true); expect(selectedStayMarker('another',stay)).toBeNull();
  });
  it('requires overnight dates and flags changes to dates, travelers or destination identity', () => {
    const stay = createSelectedStay(stayTrip,property()); expect(stay.selectionStatus).toBe('planned'); expect(stayNeedsReview(stayTrip,stay)).toBe(false);
    for (const changes of [{endDate:'2027-06-18'},{travelers:3},{destination:'Vienna'},{destinationResolution:{...resolution,providerId:'other'}}]) expect(stayNeedsReview({...stayTrip,...changes},stay)).toBe(true);
    expect(() => createSelectedStay({...stayTrip,endDate:stayTrip.startDate},property())).toThrow();
  });
});
describe('Accommodation discovery uses the shared Geoapify client', () => {
  it('queries documented name/category/circle parameters and filters wrong-area/type records', async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => response(collection(propertyFeature(),propertyFeature('far',{lat:48}),propertyFeature('hostel',{categories:['accommodation.hostel']}))));
    const discovery = new AccommodationDiscovery(new GeoapifyPlacesProvider('unit-test',new RequestClient(fetcher)));
    const found = await discovery.search({destination:resolution,type:'hotel',name:'Test',radiusKm:5});
    expect(found.properties).toHaveLength(1); const url = new URL(String(fetcher.mock.calls[0]![0]));
    expect(url.searchParams.get('filter')).toBe('circle:12.49,41.89,5000'); expect(url.searchParams.get('categories')).toBe('accommodation.hotel'); expect(url.searchParams.get('name')).toBe('Test');
    await discovery.search({destination:resolution,type:'hotel',name:'Test',radiusKm:5}); expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('returns explicit missing-key, malformed-response, authentication and quota errors', async () => {
    const request = {destination:resolution,type:'all' as const,name:'',radiusKm:5};
    await expect(new AccommodationDiscovery(new GeoapifyPlacesProvider('')).search(request)).rejects.toMatchObject({code:'configuration'});
    for (const status of [401,403,429]) await expect(new AccommodationDiscovery(new GeoapifyPlacesProvider('test',new RequestClient(async () => response({},status)))).search(request)).rejects.toThrow();
    await expect(new AccommodationDiscovery(new GeoapifyPlacesProvider('test',new RequestClient(async () => response({})))).search(request)).rejects.toThrow('invalid response');
  });
  it('handles timeout and cancellation through the existing request client', async () => {
    vi.useFakeTimers(); const fetcher = vi.fn<typeof fetch>().mockImplementation((_input,init) => new Promise((_resolve,reject) => init?.signal?.addEventListener('abort',() => reject(new DOMException('Aborted','AbortError')))));
    const discovery = new AccommodationDiscovery(new GeoapifyPlacesProvider('test',new RequestClient(fetcher)));
    const request = discovery.search({destination:resolution,type:'all',name:'',radiusKm:5}); const check = expect(request).rejects.toMatchObject({code:'timeout'}); await vi.advanceTimersByTimeAsync(10001); await check;
  });
  it('loads only requested property details and applies a tight identity check for images', async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => response(collection(propertyFeature('hotel-a',{feature_type:'details',website:'https://example.org/property'}))));
    const media = vi.spyOn(wikimediaMediaService,'resolve').mockResolvedValue(null);
    const discovery = new AccommodationDiscovery(new GeoapifyPlacesProvider('test',new RequestClient(fetcher)));
    const p = await discovery.details(property()); expect(p.place.website).toBe('https://example.org/property'); expect(p.place.image).toBeUndefined();
    expect(media).toHaveBeenCalledWith(expect.objectContaining({providerId:'hotel-a'}),undefined,200);
    expect(new URL(String(fetcher.mock.calls[0]![0])).searchParams.get('id')).toBe('hotel-a');
  });
  it('rejects missing or mismatched details without fabricating another property', async () => {
    for (const raw of [collection(),collection(propertyFeature('different',{feature_type:'details'}))]) {
      const discovery = new AccommodationDiscovery(new GeoapifyPlacesProvider('test',new RequestClient(async () => response(raw))));
      await expect(discovery.details(property())).rejects.toThrow();
    }
  });
});
