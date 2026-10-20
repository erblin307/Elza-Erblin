import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createManualExpense } from '../../budget/domain/model';
import { LocalStorageTripRepository, STORAGE_KEY } from '../services/LocalStorageTripRepository';
import { transportTrip } from '../../transport/tests/testData';
import type { Trip } from '../types/trip';
import { createTripBackup } from '../domain/backup';

const timestamp = '2026-10-20T10:00:00.000Z';

function completeTrip(): Trip {
  const estimated = createManualExpense(transportTrip, { title: 'Transit estimate', amount: 25, category: 'transportation', certainty: 'estimated', date: transportTrip.startDate, note: 'Planning amount' }, 'estimate-original', timestamp);
  const confirmed = createManualExpense(transportTrip, { title: 'Paid ticket', amount: 40, category: 'activities', certainty: 'confirmed', date: transportTrip.startDate, note: 'Historical payment' }, 'confirmed-original', timestamp);
  return { ...transportTrip, transportSettings: { defaultMode: 'walk', hotelOrigin: true, hotelReturn: true, segmentModes: { oldSegment: 'drive' } }, budgetLedger: { version: 1, expenses: [estimated, confirmed] } };
}

describe('Prompt 10 persistence acceptance', () => {
  beforeEach(() => { localStorage.clear(); vi.useFakeTimers(); vi.setSystemTime(timestamp); });
  afterEach(() => vi.useRealTimers());

  it('reopens, duplicates, edits and deletes independent complete Trips', async () => {
    const original = completeTrip();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, trips: [original] }));
    const repository = new LocalStorageTripRepository(localStorage);
    const reopened = (await repository.get(original.id))!;
    expect(reopened.itinerary).toEqual(original.itinerary);
    expect(reopened.selectedStay).toEqual(original.selectedStay);
    expect(reopened.transportSettings).toEqual(original.transportSettings);
    expect(reopened.budgetLedger).toEqual(original.budgetLedger);

    const copy = await repository.duplicate(original.id);
    expect(copy.id).not.toBe(original.id);
    expect(copy.title).toBe(`${original.title} (Copy)`);
    expect(copy.preferences).toEqual(original.preferences);
    expect(copy.itinerary?.tripId).toBe(copy.id);
    expect(copy.itinerary?.days.flatMap((day) => day.items).map((item) => item.id)).not.toEqual(original.itinerary?.days.flatMap((day) => day.items).map((item) => item.id));
    expect(copy.itinerary?.catalog.map((candidate) => candidate.providerId)).toEqual(original.itinerary?.catalog.map((candidate) => candidate.providerId));
    expect(copy.selectedStay?.tripId).toBe(copy.id);
    expect(copy.transportSettings).toMatchObject({ defaultMode: 'walk', hotelOrigin: true, hotelReturn: true, segmentModes: {} });
    expect(copy.budgetLedger?.expenses).toHaveLength(1);
    expect(copy.budgetLedger?.expenses[0]).toMatchObject({ title: 'Transit estimate', tripId: copy.id, certainty: 'estimated' });
    expect(copy.budgetLedger?.expenses[0]?.id).not.toBe('estimate-original');

    const editedCopy = await repository.update(copy.id, { ...copy, destination: 'Florence', preferences: copy.preferences });
    expect(editedCopy.destination).toBe('Florence');
    expect((await repository.get(original.id))?.destination).toBe(original.destination);
    const second = await repository.create({ ...original, destination: 'Vienna', preferences: original.preferences });
    expect((await repository.list()).map((trip) => trip.id)).toEqual(expect.arrayContaining([original.id, copy.id, second.id]));
    await repository.delete(copy.id);

    const reloaded = new LocalStorageTripRepository(localStorage);
    expect(await reloaded.get(copy.id)).toBeNull();
    expect((await reloaded.get(original.id))?.itinerary).toEqual(original.itinerary);
    expect((await reloaded.get(second.id))?.destination).toBe('Vienna');
  });

  it('detects an intervening write instead of silently overwriting it', async () => {
    const repository = new LocalStorageTripRepository(localStorage);
    const trip = await repository.create(transportTrip);
    const otherTab = new LocalStorageTripRepository(localStorage);
    await otherTab.update(trip.id, { ...trip, destination: 'Vienna' });
    await expect(repository.update(trip.id, { ...trip, travelers: 4 }, trip.updatedAt)).rejects.toThrow('another browser tab');
    expect((await repository.get(trip.id))?.destination).toBe('Vienna');
  });

  it('creates a detached, versioned backup of validated planning data', () => {
    const trip = completeTrip();
    const backup = createTripBackup([trip], timestamp);
    expect(backup).toMatchObject({ format: 'smart-travel-planner-backup', version: 1, exportedAt: timestamp });
    backup.trips[0]!.destination = 'Changed only in backup';
    expect(trip.destination).toBe('Rome');
  });
});
