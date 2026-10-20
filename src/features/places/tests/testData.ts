import type { DestinationResolution } from '../../trips/validation/destinationSchema';
import { normalizePlaces } from '../domain/normalization';

export const timestamp = '2026-10-14T00:00:00.000Z';
export const resolution: DestinationResolution = { provider: 'geoapify', providerId: 'rome-city', destinationLabel: 'Rome', formatted: 'Rome, Italy', location: { latitude: 41.89, longitude: 12.49 }, resolvedAt: timestamp };
export function feature(id = 'place-colosseum', overrides: Record<string, unknown> = {}) {
  return { properties: { place_id: id, name: 'Colosseum', lat: 41.890278, lon: 12.492222, categories: ['tourism.sights'], formatted: 'Rome, Italy', wiki_and_media: { wikidata: 'Q10285' }, ...overrides } };
}
export function collection(...features: unknown[]) { return { type: 'FeatureCollection', features }; }
export function place(id = 'place-colosseum', overrides: Record<string, unknown> = {}) { return normalizePlaces(collection(feature(id, overrides)), 'Rome', resolution.providerId, timestamp).places[0]!; }
export function response(value: unknown, status = 200, headers?: HeadersInit) { return new Response(JSON.stringify(value), { status, headers }); }
