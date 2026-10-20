import { beforeEach, describe, expect, it } from 'vitest';
import { LocalStorageTripRepository, STORAGE_KEY } from '../../trips/services/LocalStorageTripRepository';
import { generateItinerary } from '../domain/generator';
import { editItinerary } from '../domain/editing';
import { isItineraryStale } from '../domain/context';
import { candidatePool, generationOptions, testTrip } from './testData';

beforeEach(() => localStorage.clear());
describe('Trip-scoped itinerary persistence', () => {
  it('persists generation and manual changes across repository reload while isolating trips', async () => {
    const repository = new LocalStorageTripRepository(localStorage);
    const first = await repository.create(testTrip);
    const second = await repository.create(testTrip);
    const plan = generateItinerary(first, candidatePool(4), generationOptions);
    await repository.saveItinerary(first.id, plan);
    const removed = editItinerary(plan, { type: 'remove', itemId: plan.days[0]!.items[0]!.id });
    await repository.saveItinerary(first.id, removed);
    const restored = await new LocalStorageTripRepository(localStorage).get(first.id);
    expect(restored?.itinerary).toEqual(removed);
    expect(restored?.createdAt).toBe(first.createdAt);
    expect((await repository.get(second.id))?.itinerary).toBeUndefined();
  });
  it('keeps manual work and marks it stale after trip preferences change', async () => {
    const repository = new LocalStorageTripRepository(localStorage);
    const trip = await repository.create(testTrip);
    const plan = generateItinerary(trip, candidatePool(), generationOptions);
    await repository.saveItinerary(trip.id, plan);
    const changed = await repository.update(trip.id, { ...trip, destination: 'Vienna' });
    expect(changed.itinerary).toEqual(plan);
    expect(isItineraryStale(changed, plan)).toBe(true);
    await expect(repository.saveItinerary(changed.id, plan)).rejects.toThrow('preferences changed');
  });
  it('rejects cross-trip plans and malformed output without altering stored data', async () => {
    const repository = new LocalStorageTripRepository(localStorage);
    const trip = await repository.create(testTrip);
    const plan = generateItinerary(trip, candidatePool(), generationOptions);
    const raw = localStorage.getItem(STORAGE_KEY);
    await expect(repository.saveItinerary(trip.id, { ...plan, tripId: 'another-trip' })).rejects.toThrow();
    const tampered = structuredClone(plan); tampered.days[0]!.items[0]!.endMinute = 0;
    await expect(repository.saveItinerary(trip.id, tampered)).rejects.toThrow();
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
  });
  it('isolates corrupt itineraries without losing trip details or original data', async () => {
    const repository = new LocalStorageTripRepository(localStorage);
    const trip = await repository.create(testTrip);
    const corrupted = { version: 999, impossible: true };
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, trips: [{ ...trip, itinerary: corrupted }] }));
    const read = await repository.get(trip.id);
    expect(read?.destination).toBe('Rome');
    expect(read?.itinerary).toBeUndefined();
    expect(repository.getItineraryWarning(trip.id)).toContain('preserved');
    await repository.update(trip.id, { ...trip, travelers: 3 });
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).trips[0].itinerary).toEqual(corrupted);
  });
  it('does not claim a successful save when storage writes fail', async () => {
    const storage = { length: 0, getItem: () => JSON.stringify({ version: 1, trips: [testTrip] }), setItem: () => { throw new Error('Storage is full'); }, removeItem: () => {}, clear: () => {}, key: () => null } satisfies Storage;
    const repository = new LocalStorageTripRepository(storage);
    await expect(repository.saveItinerary(testTrip.id, generateItinerary(testTrip, candidatePool(), generationOptions))).rejects.toThrow('could not be saved');
  });
});
