import { livePlacesProvider } from './geoapifyProvider';
import { wikimediaMediaService } from '../../media/services/wikimediaMediaService';
import { defaultWeights, planningContext } from '../../itinerary/domain/context';
import { rankCandidates } from '../../itinerary/domain/scoring';
import type { Trip } from '../../trips/types/trip';
import type { Place } from '../domain/normalization';
import type { PlacesProvider } from './placesProvider';

export const placesRuntime = { live: livePlacesProvider, media: wikimediaMediaService };
export async function getPlacesProvider(mode: 'geoapify' | 'fixture'): Promise<PlacesProvider> {
  if (mode === 'geoapify') return placesRuntime.live;
  const { FixturePlacesProvider } = await import('../fixtures/FixturePlacesProvider'); return new FixturePlacesProvider();
}
export function rankPlaces(places: Place[], trip: Trip) {
  const ranked = rankCandidates(places, planningContext(trip), { activityAllowance: Math.floor(trip.budget.amount * 20) / 100, unknownDurationMinutes: 60, bufferMinutes: 30, weights: defaultWeights });
  return ranked.map((entry) => ({ place: places.find((place) => place.id === entry.candidate.id)!, reasons: entry.reasons }));
}
