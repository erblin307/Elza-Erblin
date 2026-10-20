import { GeoapifyPlacesProvider, livePlacesProvider } from '../../places/services/geoapifyProvider';
import { wikimediaMediaService } from '../../media/services/wikimediaMediaService';
import { normalizeAccommodations, accommodationSchema, type Accommodation } from '../domain/accommodation';
import { accommodationCategories, type AccommodationFilter } from '../domain/categories';
import type { DestinationResolution } from '../../trips/validation/destinationSchema';
import { distanceMeters } from '../../../shared/validation/geography';

export type AccommodationSearch = { destination: DestinationResolution; type: AccommodationFilter; radiusKm: number; name: string };
// The existing Geoapify client owns all network requests, cache and quota accounting.
export class AccommodationDiscovery {
  constructor(readonly geoapify: GeoapifyPlacesProvider = livePlacesProvider) {}
  async search(request: AccommodationSearch, signal?: AbortSignal) {
    const raw = await this.geoapify.searchRecords({ ...request, categories: [accommodationCategories[request.type]] }, signal);
    const result = normalizeAccommodations(raw, request.destination.providerId, new Date().toISOString());
    const properties = result.properties.filter((property) => (request.type === 'all' || property.types.includes(request.type)) && distanceMeters(request.destination.location, property.location) <= request.radiusKm * 1000);
    return { properties, rejectedCount: result.rejectedCount + result.properties.length - properties.length };
  }
  async details(property: Accommodation, signal?: AbortSignal) {
    const p = await this.geoapify.detailsRecord(property.providerId, signal);
    const result = normalizeAccommodations({ features: [{ properties: { ...p, place_id: property.providerId, name: p.name ?? property.name, lat: p.lat ?? property.location.latitude, lon: p.lon ?? property.location.longitude, categories: p.categories ?? property.place.providerCategories } }] }, property.place.destinationId, new Date().toISOString()).properties[0];
    if (!result) throw new Error('Property details are unavailable. The saved property has been preserved.');
    const merged = { ...result, place: { ...property.place, ...Object.fromEntries(Object.entries(result.place).filter(([, value]) => value !== undefined)), references: { ...property.place.references, ...Object.fromEntries(Object.entries(result.place.references).filter(([, value]) => value !== undefined)) }, image: undefined } };
    // Property photographs need a tighter proximity check than large cultural sites.
    const image = await wikimediaMediaService.resolve(merged, signal, 200);
    return accommodationSchema.parse({ ...merged, place: { ...merged.place, image: image ?? undefined } });
  }
}
export const accommodationRuntime = { discovery: new AccommodationDiscovery() };
