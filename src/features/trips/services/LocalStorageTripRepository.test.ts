import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LocalStorageTripRepository, STORAGE_KEY, TripStorageError } from './LocalStorageTripRepository';
import type { CreateTripInput } from '../types/trip';

const input: CreateTripInput = { origin: 'Pristina', destination: 'Vienna', startDate: '2027-04-02', endDate: '2027-04-08', travelers: 2, budget: { amount: 1200, currency: 'EUR' } };

describe('LocalStorageTripRepository', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it('reads older records without rewriting or adding preferences', async () => {
    const legacy = { ...input, id: 'legacy', title: 'Vienna trip', createdAt: '2026-10-14T00:00:00.000Z', updatedAt: '2026-10-14T00:00:00.000Z' };
    const raw = JSON.stringify({ version: 1, trips: [legacy] });
    localStorage.setItem(STORAGE_KEY, raw);
    await expect(new LocalStorageTripRepository(localStorage).get('legacy')).resolves.toEqual(legacy);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
  });

  it('loads an unversioned historical array and upgrades it only on a successful write', async () => {
    const legacy = { ...input, id: 'legacy', title: 'Vienna trip', createdAt: '2026-10-14T00:00:00.000Z', updatedAt: '2026-10-14T00:00:00.000Z' };
    const raw = JSON.stringify([legacy]);
    localStorage.setItem(STORAGE_KEY, raw);
    const repository = new LocalStorageTripRepository(localStorage);
    await expect(repository.list()).resolves.toEqual([legacy]);
    expect(repository.getReadWarning()).toContain('older saved-trip format');
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
    await repository.create(input);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toMatchObject({ version: 1, trips: expect.arrayContaining([legacy]) });
  });

  it('preserves legacy location labels and permits explicitly correcting them', async () => {
    const legacy = { ...input, origin: '123', id: 'legacy', title: 'Vienna trip', createdAt: '2026-10-14T00:00:00.000Z', updatedAt: '2026-10-14T00:00:00.000Z' };
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, trips: [legacy] }));
    const repository = new LocalStorageTripRepository(localStorage);
    expect((await repository.get('legacy'))?.origin).toBe('123');
    const corrected = await repository.update('legacy', input);
    expect(corrected.origin).toBe('Pristina');
    expect(corrected.createdAt).toBe(legacy.createdAt);
  });

  it('updates preferences while preserving identity and creation time', async () => {
    vi.useFakeTimers(); vi.setSystemTime('2026-10-14T00:00:00Z');
    const repository = new LocalStorageTripRepository(localStorage);
    const created = await repository.create(input);
    vi.setSystemTime('2026-10-15T00:00:00Z');
    const updated = await repository.update(created.id, { ...input, preferences: { accommodation: 'hotel', transportation: ['walking'], interests: ['history'], pace: 'active' } });
    expect(updated.id).toBe(created.id);
    expect(updated.createdAt).toBe(created.createdAt);
    expect(updated.updatedAt).toBe('2026-10-15T00:00:00.000Z');
    await expect(new LocalStorageTripRepository(localStorage).get(created.id)).resolves.toEqual(updated);
    expect(await repository.list()).toHaveLength(1);
    vi.setSystemTime('2026-10-16T00:00:00Z');
    const unchanged = await repository.update(updated.id, updated);
    expect(unchanged.updatedAt).toBe(updated.updatedAt);
  });

  it('rejects invalid writes and updates for missing IDs', async () => {
    const repository = new LocalStorageTripRepository(localStorage);
    await expect(repository.create({ ...input, travelers: 0 })).rejects.toThrow();
    await expect(repository.update('missing', input)).rejects.toThrow('no longer exists');
    await expect(repository.list()).resolves.toEqual([]);
  });

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

  it('isolates damaged records while preserving their original data on writes', async () => {
    const repository = new LocalStorageTripRepository(localStorage);
    const healthy = await repository.create(input);
    const broken = { id: 'broken', title: 'Broken', invalid: true };
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, trips: [healthy, broken] }));
    await expect(repository.list()).resolves.toEqual([healthy]);
    expect(repository.getReadWarning()).toContain('1 saved trip');
    await expect(repository.get('broken')).rejects.toThrow('preserved');
    await expect(repository.get('absent')).resolves.toBeNull();
    const created = await repository.create(input);
    await repository.update(healthy.id, { ...input, destination: 'Vienna, Austria' });
    await repository.delete(created.id);
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as { trips: unknown[] };
    expect(stored.trips).toContainEqual(broken);
    expect(await repository.list()).toHaveLength(1);
  });

  it('preserves fields outside the planner during updates', async () => {
    const repository = new LocalStorageTripRepository(localStorage);
    const created = await repository.create(input);
    const unmanaged = { futureModule: { itemIds: ['item-1'] } };
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, trips: [{ ...created, title: 'My journey', ...unmanaged, preferences: { ...created.preferences, providerMetadata: 'retained' }, budget: { ...created.budget, annotation: 'retained' } }] }));
    const updated = await repository.update(created.id, { ...input, destination: 'Vienna, Austria' });
    expect(updated.title).toBe('My journey');
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as { trips: Record<string, unknown>[] };
    expect(stored.trips[0]).toMatchObject(unmanaged);
    expect(stored.trips[0]).toMatchObject({ preferences: { providerMetadata: 'retained' }, budget: { annotation: 'retained' } });
  });

  it('does not select between conflicting duplicate IDs', async () => {
    const repository = new LocalStorageTripRepository(localStorage);
    const created = await repository.create(input);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, trips: [created, { ...created, destination: 'Other city' }] }));
    await expect(repository.list()).resolves.toEqual([]);
    await expect(repository.get(created.id)).rejects.toThrow('preserved');
  });

  it('reports storage write failures', async () => {
    const failingStorage = { getItem: () => null, setItem: () => { throw new DOMException('blocked'); }, removeItem: () => {}, clear: () => {}, key: () => null, length: 0 } satisfies Storage;
    await expect(new LocalStorageTripRepository(failingStorage).create(input)).rejects.toThrow('could not be saved');
  });

  it('handles browsers that deny access to localStorage itself', async () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new DOMException('Access denied', 'SecurityError'); });
    const repository = new LocalStorageTripRepository();
    await expect(repository.list()).rejects.toThrow('unavailable in this browser');
  });
});
