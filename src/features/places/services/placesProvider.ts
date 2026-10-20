import type { DestinationResolution } from '../../trips/validation/destinationSchema';
import type { Place } from '../domain/normalization';

export type PlaceSearch = { destination: DestinationResolution; categories: string[]; name: string; radiusKm: number };
export interface PlacesProvider {
  readonly configured: boolean;
  readonly mode: 'geoapify' | 'fixture';
  resolve(destinationLabel: string, signal?: AbortSignal): Promise<DestinationResolution[]>;
  search(request: PlaceSearch, signal?: AbortSignal): Promise<{ places: Place[]; rejectedCount: number }>;
  details(place: Place, signal?: AbortSignal): Promise<Place>;
}
