import { z } from 'zod';
import { ProviderError, RequestClient } from '../../../shared/services/requestClient';
import { canonicalDestination } from '../../../shared/validation/location';
import { destinationResolutionSchema, type DestinationResolution } from '../../trips/validation/destinationSchema';
import type { ActivityCandidateProvider, ActivitySearchRequest } from '../../itinerary/services/ActivityCandidateProvider';
import { categoriesForInterests, discoveryCategories } from '../domain/categories';
import { normalizeDestinations, normalizePlaces, optionalText, type Place } from '../domain/normalization';
import type { PlacesProvider, PlaceSearch } from './placesProvider';
import { accommodationCategories } from '../../accommodation/domain/categories';

export class GeoapifyPlacesProvider implements PlacesProvider {
  readonly mode = 'geoapify';
  readonly configured: boolean;
  constructor(private key = import.meta.env.VITE_GEOAPIFY_API_KEY ?? '', private client = new RequestClient()) { this.configured = !!key.trim(); }
  private url(path: string, params: Record<string, string>) {
    if (!this.configured) throw new ProviderError('configuration', 'Places discovery requires provider configuration. Set VITE_GEOAPIFY_API_KEY and restrict its allowed origins.');
    const url = new URL(`https://api.geoapify.com/${path}`);
    Object.entries({ ...params, apiKey: this.key }).forEach(([key, value]) => url.searchParams.set(key, value));
    return url.href;
  }
  async resolve(destinationLabel: string, signal?: AbortSignal) {
    if (!destinationLabel.trim() || destinationLabel.length > 500) throw new ProviderError('invalid-data', 'Enter a valid destination in your trip.');
    const response = await this.client.get(this.url('v1/geocode/search', { text: destinationLabel, type: 'city', lang: 'en', limit: '5', format: 'geojson' }), signal);
    return normalizeDestinations(response, destinationLabel, new Date().toISOString());
  }
  async routingRecords(waypoints: string, mode: 'walk' | 'drive' | 'bicycle', signal?: AbortSignal): Promise<unknown> {
    return this.client.get(this.url('v1/routing', { waypoints, mode, format: 'geojson', units: 'metric', type: 'balanced', traffic: 'free_flow', optimize_stops: 'false' }), signal);
  }
  async searchRecords(request: PlaceSearch, signal?: AbortSignal): Promise<unknown> {
    if (!destinationResolutionSchema.safeParse(request.destination).success || request.destination.provider !== 'geoapify') throw new ProviderError('invalid-data', 'Confirm a Geoapify destination before a live search.');
    const supported: string[] = [...discoveryCategories.all, ...Object.values(accommodationCategories)];
    if (request.categories.some((category) => !supported.includes(category))) throw new ProviderError('invalid-data', 'Choose a supported place category.');
    if (!Number.isFinite(request.radiusKm) || request.radiusKm < 1 || request.radiusKm > 20 || !request.categories.length || request.categories.length > 8 || request.name.length > 100) throw new ProviderError('invalid-data', 'Use a search radius between 1 and 20 km and a name up to 100 characters.');
    const { latitude, longitude } = request.destination.location;
    return this.client.get(this.url('v2/places', { categories: request.categories.join(','), filter: `circle:${longitude},${latitude},${request.radiusKm * 1000}`, bias: `proximity:${longitude},${latitude}`, limit: '30', lang: 'en', ...(request.name.trim() ? { name: request.name.trim() } : {}) }), signal);
  }
  async search(request: PlaceSearch, signal?: AbortSignal) {
    const response = await this.searchRecords(request, signal);
    return normalizePlaces(response, request.destination.destinationLabel, request.destination.providerId, new Date().toISOString());
  }
  async detailsRecord(providerId: string, signal?: AbortSignal): Promise<Record<string, unknown>> {
    if (!/^[a-zA-Z0-9_-]{1,512}$/u.test(providerId)) throw new ProviderError('invalid-data', 'Invalid property identifier.');
    const response = await this.client.get(this.url('v2/place-details', { id: providerId, features: 'details', lang: 'en' }), signal);
    const envelope = z.object({ features: z.array(z.object({ properties: z.record(z.string(), z.unknown()) })) }).safeParse(response);
    const details = envelope.success ? envelope.data.features.filter((entry) => entry.properties.feature_type === 'details') : [];
    if (details.length !== 1) throw new ProviderError('invalid-data', 'Place details are unavailable or ambiguous. Search information is retained.');
    const p = details[0]!.properties;
    if (p.place_id !== undefined && p.place_id !== providerId) throw new ProviderError('invalid-data', 'The place details identity does not match the selected place.');
    return p;
  }
  async details(place: Place, signal?: AbortSignal): Promise<Place> {
    const p = await this.detailsRecord(place.providerId, signal);
    const normalized = normalizePlaces({ features: [{ properties: { ...p, place_id: place.providerId, name: p.name ?? place.name, lat: p.lat ?? place.location.latitude, lon: p.lon ?? place.location.longitude, categories: p.categories ?? place.place.providerCategories, formatted: p.formatted ?? place.place.address } }] }, place.destination, place.place.destinationId, new Date().toISOString()).places[0];
    if (!normalized) throw new ProviderError('invalid-data', 'Place details could not be validated. Search information is retained.');
    const supplied = Object.fromEntries(Object.entries(normalized.place).filter(([, value]) => value !== undefined));
    const references = Object.fromEntries(Object.entries(normalized.place.references).filter(([, value]) => value !== undefined));
    return { ...normalized, description: optionalText(p.description, 2000), place: { ...place.place, ...supplied, references: { ...place.place.references, ...references }, image: place.place.image } };
  }
}
export const livePlacesProvider = new GeoapifyPlacesProvider();
export class GeoapifyCandidateProvider implements ActivityCandidateProvider {
  constructor(private provider: PlacesProvider = livePlacesProvider) {}
  async searchCandidates(request: ActivitySearchRequest) {
    const destination: DestinationResolution | undefined = request.destinationResolution;
    if (!destination || destination.provider !== 'geoapify' || canonicalDestination(destination.destinationLabel) !== canonicalDestination(request.destination)) throw new ProviderError('configuration', 'Open Places and confirm the destination before generating a live itinerary.');
    const response = await this.provider.search({ destination, categories: categoriesForInterests(request.preferences?.interests ?? []), name: '', radiusKm: 5 });
    return { candidates: response.places, dataMode: 'live' as const, sourceLabel: 'Geoapify / OpenStreetMap · 5 km search radius · up to 30 candidates' };
  }
}
