import type { Trip } from '../../trips/types/trip';
import { generateItinerary } from '../domain/generator';
import { UnavailableActivityProvider, type ActivityCandidateProvider } from './ActivityCandidateProvider';
import { geoapifyConfigured } from '../../places/services/providerConfig';

export class InsufficientActivityDataError extends Error {
  constructor() { super('No suitable activity data is available for this destination and these interests. Your current plan is unchanged.'); this.name = 'InsufficientActivityDataError'; }
}

export type CandidateSourceMode = 'live' | 'demo' | 'geographic-demo';
export async function generateTripItinerary(trip: Trip, activityAllowance: number, mode: CandidateSourceMode, provider?: ActivityCandidateProvider) {
  let candidateProvider = provider;
  if (!candidateProvider) {
    if (mode === 'geographic-demo') { const { GeographicFixtureActivityProvider } = await import('../fixtures/GeographicFixtureActivityProvider'); candidateProvider = new GeographicFixtureActivityProvider(); }
    else if (mode === 'demo') { const { FixtureActivityProvider } = await import('../fixtures/FixtureActivityProvider'); candidateProvider = new FixtureActivityProvider(); }
    else if (geoapifyConfigured) { const { GeoapifyCandidateProvider } = await import('../../places/services/geoapifyProvider'); candidateProvider = new GeoapifyCandidateProvider(); }
    else candidateProvider = new UnavailableActivityProvider();
  }
  const result = await candidateProvider.searchCandidates({ destination: trip.destination, startDate: trip.startDate, endDate: trip.endDate, destinationResolution: trip.destinationResolution, preferences: trip.preferences });
  if (result.dataMode !== (mode === 'live' ? 'live' : 'demo')) throw new Error('The candidate source does not match the selected data mode.');
  const itinerary = generateItinerary(trip, result.candidates, { activityAllowance, dataMode: result.dataMode, sourceLabel: result.sourceLabel, generatedAt: new Date().toISOString() });
  if (!itinerary.days.some((day) => day.items.length)) throw new InsufficientActivityDataError();
  return itinerary;
}
