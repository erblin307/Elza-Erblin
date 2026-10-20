import { z } from 'zod';
import { activityCandidateSchema } from '../../itinerary/domain/validation';
import { destinationResolutionSchema } from '../../trips/validation/destinationSchema';
import { canonicalDestination, geoLocationSchema } from '../../../shared/validation/location';
import { translateCategories } from './categories';
import { normalizeGeoEntity } from './geoEntity';
export { optionalText } from './geoEntity';

export const placeSchema = activityCandidateSchema.safeExtend({ location: geoLocationSchema, providerId: z.string().regex(/^[a-zA-Z0-9_-]{1,512}$/u), place: activityCandidateSchema.shape.place.unwrap() });
export type Place = z.infer<typeof placeSchema>;
const fields = z.record(z.string(), z.unknown());
const collection = z.object({ features: z.array(z.unknown()) });
const feature = z.object({ properties: fields });
export function normalizeDestinations(raw: unknown, destinationLabel: string, now: string) {
  const response = collection.safeParse(raw); if (!response.success) throw new Error('The destination provider returned an invalid response.');
  const found = response.data.features.flatMap((entry) => {
    const parsed = feature.safeParse(entry); if (!parsed.success) return [];
    const p = parsed.data.properties;
    const result = destinationResolutionSchema.safeParse({ provider: 'geoapify', providerId: p.place_id, destinationLabel, formatted: p.formatted, location: { latitude: p.lat, longitude: p.lon }, resolvedAt: now });
    return result.success ? [result.data] : [];
  });
  return [...new Map(found.map((entry) => [entry.providerId, entry])).values()];
}
export function normalizePlaces(raw: unknown, destination: string, destinationId: string, now: string) {
  const response = collection.safeParse(raw); if (!response.success) throw new Error('The places provider returned an invalid response.');
  const places = new Map<string, Place>(); const conflicting = new Set<string>(); let rejectedCount = 0;
  for (const entry of response.data.features) {
    const parsed = feature.safeParse(entry); if (!parsed.success) { rejectedCount++; continue; }
    const p = parsed.data.properties;
    const entity = normalizeGeoEntity(p, destinationId, now);
    if (!entity.success) { rejectedCount++; continue; }
    const normalized = placeSchema.safeParse({
      ...entity.data, destination: canonicalDestination(destination), categories: translateCategories(entity.data.place.providerCategories), source: 'provider', sourceName: 'Geoapify / OpenStreetMap',
    });
    if (!normalized.success) { rejectedCount++; continue; }
    if (conflicting.has(normalized.data.id)) { rejectedCount++; continue; }
    const prior = places.get(normalized.data.id);
    if (prior) {
      if (prior.location.latitude !== normalized.data.location.latitude || prior.location.longitude !== normalized.data.location.longitude) { places.delete(prior.id); conflicting.add(prior.id); rejectedCount += 2; continue; }
      normalized.data.categories = [...new Set([...prior.categories, ...normalized.data.categories])];
      normalized.data.place.providerCategories = [...new Set([...prior.place.providerCategories, ...normalized.data.place.providerCategories])];
      normalized.data.place.references = { ...normalized.data.place.references, ...Object.fromEntries(Object.entries(prior.place.references).filter(([, value]) => value !== undefined)) };
    }
    places.set(normalized.data.id, normalized.data);
  }
  return { places: [...places.values()], rejectedCount };
}
