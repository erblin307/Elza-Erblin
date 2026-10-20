import { GeographicFixtureActivityProvider } from '../../itinerary/fixtures/GeographicFixtureActivityProvider';
import type { DestinationResolution } from '../../trips/validation/destinationSchema';
import { placeSchema, type Place } from '../domain/normalization';
import { translateCategories } from '../domain/categories';
import type { PlacesProvider, PlaceSearch } from '../services/placesProvider';

export class FixturePlacesProvider implements PlacesProvider {
  readonly mode = 'fixture'; readonly configured = true;
  async resolve(destinationLabel: string): Promise<DestinationResolution[]> {
    const data = await new GeographicFixtureActivityProvider().searchCandidates({ destination: destinationLabel, startDate: '2027-06-12', endDate: '2027-06-17' });
    const candidates = data.candidates.map((value) => value as Place).filter((entry) => entry.location);
    const anchor = candidates[0]; if (!anchor) return [];
    return [{ provider: 'fixture', providerId: `fixture-area-${anchor.providerId}`, destinationLabel, formatted: `${destinationLabel} landmark demonstration area — not geocoding`, location: anchor.location, resolvedAt: new Date().toISOString() }];
  }
  async search(request: PlaceSearch) {
    const data = await new GeographicFixtureActivityProvider().searchCandidates({ destination: request.destination.destinationLabel, startDate: '2027-06-12', endDate: '2027-06-17' });
    const interests = translateCategories(request.categories);
    const places = data.candidates.map((value) => value as Place).filter((entry) => entry.location && entry.name.toLowerCase().includes(request.name.toLowerCase()) && entry.categories.some((category) => interests.includes(category)))
      .map((entry) => placeSchema.parse({ ...entry, place: { provider: 'fixture', destinationId: request.destination.providerId, providerCategories: ['tourism.sights'], references: { wikidataId: entry.providerId }, fetchedAt: new Date().toISOString(), attribution: `${entry.sourceName} · static development fixture, not Geoapify` } }));
    return { places, rejectedCount: 0 };
  }
  async details(place: Place) { return place; }
}
