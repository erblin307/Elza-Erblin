import type { Trip } from '../../trips/types/trip';

export type ActivitySearchRequest = Pick<Trip, 'destination' | 'startDate' | 'endDate' | 'destinationResolution' | 'preferences'>;
export type CandidateSearchResult = { candidates: unknown[]; dataMode: 'live' | 'demo'; sourceLabel: string };
export interface ActivityCandidateProvider { searchCandidates(request: ActivitySearchRequest): Promise<CandidateSearchResult> }

export class UnavailableActivityProvider implements ActivityCandidateProvider {
  async searchCandidates(): Promise<CandidateSearchResult> {
    return { candidates: [], dataMode: 'live', sourceLabel: 'No live activity provider configured' };
  }
}
