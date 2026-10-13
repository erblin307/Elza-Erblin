import { beforeEach, describe, expect, it } from 'vitest';
import { LocalStorageTripRepository, STORAGE_KEY, TripStorageError } from './LocalStorageTripRepository';
import type { CreateTripInput } from '../types/trip';

const input: CreateTripInput = { origin: 'Pristina', destination: 'Vienna', startDate: '2027-04-02', endDate: '2027-04-08', travelers: 2, budget: { amount: 1200, currency: 'EUR' } };

describe('LocalStorageTripRepository', () => {
  beforeEach(() => localStorage.clear());

  it('creates, lists, and loads a saved trip', async () => {
    const repository = new LocalStorageTripRepository(localStorage);
    const created = await repository.create(input);
    expect(created.id).toBeTruthy();
    expect(created.title).toBe('Vienna trip');
    await expect(repository.list()).resolves.toEqual([created]);
    await expect(repository.get(created.id)).resolves.toEqual(created);
  });

  it('deletes a saved trip', async () => {
    const repository = new LocalStorageTripRepository(localStorage);
    const created = await repository.create(input);
    await repository.delete(created.id);
    await expect(repository.list()).resolves.toEqual([]);
  });

  it('returns null for a missing trip ID', async () => { await expect(new LocalStorageTripRepository(localStorage).get('missing')).resolves.toBeNull(); });

  it('reports unsupported or invalid stored data', async () => {
    localStorage.setItem(STORAGE_KEY, '{not-json');
    await expect(new LocalStorageTripRepository(localStorage).list()).rejects.toBeInstanceOf(TripStorageError);
  });

  it('reports storage write failures', async () => {
    const failingStorage = { getItem: () => null, setItem: () => { throw new DOMException('blocked'); }, removeItem: () => {}, clear: () => {}, key: () => null, length: 0 } satisfies Storage;
    await expect(new LocalStorageTripRepository(failingStorage).create(input)).rejects.toThrow('could not be saved');
  });
});
