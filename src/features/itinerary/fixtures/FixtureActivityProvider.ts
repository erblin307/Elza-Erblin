import type { ActivityCandidate } from '../types/itinerary';
import type { ActivityCandidateProvider, ActivitySearchRequest, CandidateSearchResult } from '../services/ActivityCandidateProvider';

// Isolated demonstration inputs, not live attraction data or actual ticket prices.
const samples: Omit<ActivityCandidate, 'destination'>[] = [
  { id: 'sample-history-walk', name: 'Historic district study walk', categories: ['history', 'architecture'], durationMinutes: 90, source: 'fixture', sourceName: 'Development sample', description: 'A demonstration walking activity. Location, entry requirements, hours, and prices are unverified.' },
  { id: 'sample-architecture-sketch', name: 'Architecture sketching exercise', categories: ['architecture', 'culture'], durationMinutes: 75, price: { amount: 12, currency: 'EUR', unit: 'person', basis: 'sample_estimate' }, source: 'fixture', sourceName: 'Development sample', description: 'Synthetic planning exercise with a sample per-person cost. No class or reservation is offered.' },
  { id: 'sample-food-exploration', name: 'Neighborhood food exploration', categories: ['food', 'culture'], durationMinutes: 90, source: 'fixture', sourceName: 'Development sample', description: 'Demonstration activity; food purchases have unknown costs.' },
  { id: 'sample-museum-study', name: 'Museum collection study', categories: ['museums', 'history'], durationMinutes: 120, source: 'fixture', sourceName: 'Development sample', description: 'Sample museum activity without a named venue, ticket price, or verified opening hours.' },
  { id: 'sample-heritage-notes', name: 'Heritage observation exercise', categories: ['history'], durationMinutes: 60, price: { amount: 0, currency: 'EUR', unit: 'group', basis: 'sample_estimate' }, source: 'fixture', sourceName: 'Development sample' },
  { id: 'sample-food-workshop', name: 'Food workshop planning exercise', categories: ['food'], durationMinutes: 100, price: { amount: 20, currency: 'EUR', unit: 'group', basis: 'sample_estimate' }, source: 'fixture', sourceName: 'Development sample', description: 'Sample group cost for testing; not a real workshop listing.' },
  { id: 'sample-city-photography', name: 'City architecture photography', categories: ['architecture'], durationMinutes: 80, price: { amount: 8, currency: 'EUR', unit: 'entry', entriesRequired: 2, basis: 'sample_estimate' }, source: 'fixture', sourceName: 'Development sample', description: 'Synthetic estimate explicitly represents two entries; no venue or admission is implied.' },
  { id: 'sample-market-notes', name: 'Local market observation', categories: ['food', 'shopping'], durationMinutes: 60, source: 'fixture', sourceName: 'Development sample' },
  { id: 'sample-culture-session', name: 'Cultural interpretation session', categories: ['culture', 'history'], source: 'fixture', sourceName: 'Development sample', description: 'Duration is unknown and will use a disclosed planning assumption.' },
  { id: 'sample-park-pause', name: 'Park and garden pause', categories: ['nature', 'relaxation'], durationMinutes: 45, source: 'fixture', sourceName: 'Development sample' },
  { id: 'sample-building-styles', name: 'Building styles comparison', categories: ['architecture'], durationMinutes: 65, source: 'fixture', sourceName: 'Development sample' },
  { id: 'sample-history-reflection', name: 'Historical context reflection', categories: ['history'], durationMinutes: 50, source: 'fixture', sourceName: 'Development sample' },
  { id: 'sample-tasting-notes', name: 'Regional food tasting notes', categories: ['food'], durationMinutes: 60, source: 'fixture', sourceName: 'Development sample' },
  { id: 'sample-evening-walk', name: 'Evening neighborhood walk', categories: ['architecture', 'relaxation'], durationMinutes: 70, source: 'fixture', sourceName: 'Development sample' },
];

export const fixtureDestinations = ['Rome / Rome, Italy', 'Vienna / Vienna, Austria'];

export class FixtureActivityProvider implements ActivityCandidateProvider {
  async searchCandidates(request: ActivitySearchRequest): Promise<CandidateSearchResult> {
    const destination = request.destination.normalize('NFC').trim().replace(/\s+/gu, ' ').toLowerCase();
    const supported = ['rome', 'rome, italy', 'vienna', 'vienna, austria'].includes(destination);
    return { candidates: supported ? samples.map((candidate) => ({ ...candidate, destination })) : [], dataMode: 'demo', sourceLabel: 'Development fixtures — synthetic planning examples and sample costs' };
  }
}
