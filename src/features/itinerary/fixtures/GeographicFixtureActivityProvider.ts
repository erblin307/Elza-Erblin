import type { ActivityCandidate } from '../types/itinerary';
import type { ActivityCandidateProvider, ActivitySearchRequest, CandidateSearchResult } from '../services/ActivityCandidateProvider';
import { FixtureActivityProvider } from './FixtureActivityProvider';

// Coordinates checked against the cited Wikidata P625 statements on 2026-10-14.
// These are static landmark examples, not live search, entrance coordinates or bookings.
const rome: Omit<ActivityCandidate, 'destination'>[] = [
  { id: 'landmark-colosseum', name: 'Colosseum · landmark study', categories: ['history', 'architecture'], source: 'fixture', sourceName: 'Wikidata Q10285 coordinate snapshot', providerId: 'Q10285', location: { latitude: 41 + 53 / 60 + 25 / 3600, longitude: 12 + 29 / 60 + 32 / 3600 }, description: 'Development itinerary example at the Colosseum landmark. Coordinate source: https://www.wikidata.org/wiki/Q10285 (P625). Price, opening hours and visit duration are unknown. Not a live listing or ticket offer.' },
  { id: 'landmark-pantheon', name: 'Pantheon · landmark study', categories: ['history', 'architecture'], source: 'fixture', sourceName: 'Wikidata Q99309 coordinate snapshot', providerId: 'Q99309', location: { latitude: 41 + 53 / 60 + 55 / 3600, longitude: 12 + 28 / 60 + 37 / 3600 }, description: 'Development itinerary example at the Pantheon landmark. Coordinate source: https://www.wikidata.org/wiki/Q99309 (P625). Price, opening hours and visit duration are unknown. Not a live listing or ticket offer.' },
  { id: 'landmark-trajan', name: 'Trajan’s Forum · landmark study', categories: ['history', 'architecture'], source: 'fixture', sourceName: 'Wikidata Q211295 coordinate snapshot', providerId: 'Q211295', location: { latitude: 41 + 53 / 60 + 43.51 / 3600, longitude: 12 + 29 / 60 + 9.13 / 3600 }, description: 'Development itinerary example at the forum landmark. Coordinate source: https://www.wikidata.org/wiki/Q211295 (P625). Price, opening hours and visit duration are unknown. This point is not a verified entrance or a route.' },
];
const vienna: Omit<ActivityCandidate, 'destination'>[] = [
  { id: 'landmark-stephen', name: 'St. Stephen’s Cathedral · landmark study', categories: ['history', 'architecture'], source: 'fixture', sourceName: 'Wikidata Q5943 coordinate snapshot', providerId: 'Q5943', location: { latitude: 48 + 12 / 60 + 30.337 / 3600, longitude: 16 + 22 / 60 + 23.722 / 3600 }, description: 'Development itinerary example at the cathedral landmark. Coordinate source: https://www.wikidata.org/wiki/Q5943 (P625). Price, opening hours and visit duration are unknown. Not a live listing or ticket offer.' },
];
export class GeographicFixtureActivityProvider implements ActivityCandidateProvider {
  async searchCandidates(request: ActivitySearchRequest): Promise<CandidateSearchResult> {
    const base = await new FixtureActivityProvider().searchCandidates(request);
    const destination = request.destination.normalize('NFC').trim().replace(/\s+/gu, ' ').toLowerCase();
    const landmarks = ['rome', 'rome, italy'].includes(destination) ? rome : ['vienna', 'vienna, austria'].includes(destination) ? vienna : [];
    return { candidates: [...base.candidates, ...landmarks.map((entry) => ({ ...entry, destination }))], dataMode: 'demo', sourceLabel: 'Geographic development fixtures — sourced landmark coordinates, generic exercises and sample costs' };
  }
}
