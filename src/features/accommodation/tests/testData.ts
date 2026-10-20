import { testTrip } from '../../itinerary/tests/testData';
import { resolution, timestamp, collection, feature } from '../../places/tests/testData';
import { normalizeAccommodations } from '../domain/accommodation';
export { resolution, timestamp, collection, response } from '../../places/tests/testData';
export const stayTrip = { ...testTrip, endDate: '2027-06-17', destinationResolution: resolution };
// Network contract fixtures only. These names are not real hotel recommendations.
export function propertyFeature(id = 'hotel-a', overrides: Record<string, unknown> = {}) { return feature(id, { name: `Test property ${id}`, categories: ['accommodation.hotel'], wiki_and_media: undefined, ...overrides }); }
export function property(id = 'hotel-a', overrides: Record<string, unknown> = {}) { return normalizeAccommodations(collection(propertyFeature(id, overrides)), resolution.providerId, timestamp).properties[0]!; }
