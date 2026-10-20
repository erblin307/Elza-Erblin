import { beforeEach, describe, expect, it } from 'vitest';
import { LocalStorageTripRepository, STORAGE_KEY } from '../../trips/services/LocalStorageTripRepository';
import { testTrip, generationOptions } from '../../itinerary/tests/testData';
import { generateItinerary } from '../../itinerary/domain/generator';
import { isItineraryStale } from '../../itinerary/domain/context';
import { costSummary } from '../../itinerary/domain/costs';
import { mapActivities, mapMarkers } from '../../map/domain/mapData';
import { addDiscoveredPlace } from '../services/itineraryPlaces';
import { rankPlaces } from '../services/placesService';
import { place, resolution } from './testData';

beforeEach(() => localStorage.clear());
describe('Selected places through existing Trip persistence and map', () => {
  it('confirms destination without changing text, adds to Day 2 and restores identity/coordinates on reload', async () => {
    const repository = new LocalStorageTripRepository(localStorage); const original = await repository.create(testTrip);
    const trip = await repository.saveDestination(original.id, resolution);
    expect(trip.destination).toBe(original.destination);
    const plan = addDiscoveredPlace(trip, place(), 'day-2027-06-13'); await repository.saveItinerary(trip.id, plan);
    const restored = (await new LocalStorageTripRepository(localStorage).get(trip.id))!;
    expect(restored.destinationResolution).toEqual(resolution); expect(restored.itinerary?.days[1]!.items).toHaveLength(1);
    expect(restored.itinerary?.catalog[0]?.providerId).toBe(place().providerId); expect(mapMarkers(mapActivities(trip.id, restored.itinerary))[0]?.location).toEqual(place().location);
    expect(costSummary(plan.days.flatMap((day) => day.items), plan.catalog, plan.context)).toEqual({ knownCost: 0, unknownCount: 1 });
    expect(plan.days[1]!.items[0]!.durationAssumed).toBe(true);
  });
  it('prevents duplicate provider entity and out-of-trip day additions', async () => {
    const repository = new LocalStorageTripRepository(localStorage); const trip = await repository.saveDestination((await repository.create(testTrip)).id, resolution);
    const saved = await repository.saveItinerary(trip.id, addDiscoveredPlace(trip, place(), 'day-2027-06-13'));
    expect(() => addDiscoveredPlace(saved, place(), 'day-2027-06-12')).toThrow('already planned');
    expect(() => addDiscoveredPlace(saved, { ...place(), id: 'another-id' }, 'day-2027-06-12')).toThrow('already planned');
    expect(() => addDiscoveredPlace(trip, place(), 'day-2030-01-01')).toThrow('existing itinerary day');
  });
  it('keeps two trips isolated and rejects mismatched destination identity', async () => {
    const repository = new LocalStorageTripRepository(localStorage); const first = await repository.saveDestination((await repository.create(testTrip)).id, resolution); const second = await repository.create({ ...testTrip, destination: 'Vienna' });
    await repository.saveItinerary(first.id, addDiscoveredPlace(first, place(), 'day-2027-06-13'));
    expect((await repository.get(second.id))?.itinerary).toBeUndefined();
    expect(() => addDiscoveredPlace(second, place(), 'day-2027-06-13')).toThrow('Resolve');
    await expect(repository.saveDestination(second.id, resolution)).rejects.toThrow('destination changed');
  });
  it('marks an old itinerary stale when a destination is confirmed and preserves manual work', async () => {
    const repository = new LocalStorageTripRepository(localStorage); const original = await repository.create(testTrip);
    const old = generateItinerary(original, [], generationOptions); await repository.saveItinerary(original.id, old);
    const resolved = await repository.saveDestination(original.id, resolution);
    expect(resolved.itinerary).toEqual(old); expect(isItineraryStale(resolved, old)).toBe(true);
    expect(() => addDiscoveredPlace(resolved, place(), 'day-2027-06-13')).toThrow('outdated');
  });
  it('clears destination enrichment only on a meaningful destination change', async () => {
    const repository = new LocalStorageTripRepository(localStorage); const trip = await repository.saveDestination((await repository.create(testTrip)).id, resolution);
    const notes = await repository.update(trip.id, { ...trip, preferences: { ...trip.preferences!, notes: 'New notes' } }); expect(notes.destinationResolution).toEqual(resolution);
    const changed = await repository.update(trip.id, { ...notes, destination: 'Vienna' }); expect(changed.destinationResolution).toBeUndefined(); expect((await repository.get(trip.id))?.destinationResolution).toBeUndefined();
  });
  it('does not quarantine healthy trip details for invalid enrichment or silently destroy its raw value', async () => {
    const corrupted = { provider: 'geoapify', impossible: true };
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, trips: [{ ...testTrip, destinationResolution: corrupted }] }));
    const repository = new LocalStorageTripRepository(localStorage); const trip = (await repository.get(testTrip.id))!; expect(trip.destinationResolution).toBeUndefined();
    await repository.update(trip.id, { ...trip, travelers: 3 }); expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).trips[0].destinationResolution).toEqual(corrupted);
  });
  it('reuses preference scoring but leaves other discoveries visible and missing quality unknown', () => {
    const food = place('food', { categories: ['catering.restaurant'] }); const history = place('history');
    const ranked = rankPlaces([food, history], { ...testTrip, preferences: { ...testTrip.preferences!, interests: ['history'] } });
    expect(ranked.map((entry) => entry.place.id)).toEqual([history.id, food.id]); expect(ranked[0]!.reasons[0]).toContain('History'); expect(ranked).toHaveLength(2);
  });
});
