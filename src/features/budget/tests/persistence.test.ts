import { beforeEach, describe, expect, it } from 'vitest';
import { LocalStorageTripRepository, STORAGE_KEY } from '../../trips/services/LocalStorageTripRepository';
import { budgetLedgerSchema, createManualExpense } from '../domain/model';
import { createBudgetTrip } from './testData';

const now = '2026-10-20T00:00:00.000Z';

describe('budget persistence', () => {
  beforeEach(() => localStorage.clear());

  it('persists manual expenses inside the owning Trip and survives reload', async () => {
    const repository = new LocalStorageTripRepository(localStorage);
    const trip = await repository.create(createBudgetTrip());
    const expense = createManualExpense(trip, { title: 'Dinner', amount: 45, category: 'food', certainty: 'confirmed', date: trip.startDate, note: 'Receipt saved' }, 'dinner', now);
    await repository.saveBudgetLedger(trip.id, { version: 1, expenses: [expense] });
    expect((await new LocalStorageTripRepository(localStorage).get(trip.id))?.budgetLedger?.expenses).toEqual([expense]);
  });

  it('rejects cross-trip and duplicate expense identities', async () => {
    const repository = new LocalStorageTripRepository(localStorage);
    const first = await repository.create(createBudgetTrip());
    const second = await repository.create({ ...createBudgetTrip(), destination: 'Vienna' });
    const expense = createManualExpense(first, { title: 'Dinner', amount: 45, category: 'food', certainty: 'confirmed', date: '', note: '' }, 'dinner', now);
    await expect(repository.saveBudgetLedger(second.id, { version: 1, expenses: [expense] })).rejects.toThrow('another trip');
    await expect(repository.saveBudgetLedger(first.id, { version: 1, expenses: [expense, expense] })).rejects.toThrow();
  });

  it('preserves a malformed ledger during unrelated Trip updates', async () => {
    const repository = new LocalStorageTripRepository(localStorage);
    const trip = await repository.create(createBudgetTrip());
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, trips: [{ ...trip, budgetLedger: { version: 1, expenses: [{ bad: true }] } }] }));
    expect((await repository.get(trip.id))?.budgetLedger).toBeUndefined();
    expect(repository.getBudgetWarning(trip.id)).toContain('preserved');
    await repository.update(trip.id, { ...trip, budget: { ...trip.budget, amount: 700 } });
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).trips[0].budgetLedger).toEqual({ version: 1, expenses: [{ bad: true }] });
  });

  it('keeps manual expense currency unchanged when the Trip currency changes', async () => {
    const repository = new LocalStorageTripRepository(localStorage);
    const trip = await repository.create(createBudgetTrip());
    const expense = createManualExpense(trip, { title: 'Dinner', amount: 45, category: 'food', certainty: 'confirmed', date: '', note: '' }, 'dinner', now);
    await repository.saveBudgetLedger(trip.id, { version: 1, expenses: [expense] });
    await repository.update(trip.id, { ...trip, budget: { amount: 700, currency: 'USD' } });
    const rawLedger = JSON.parse(localStorage.getItem(STORAGE_KEY)!).trips[0].budgetLedger;
    expect(rawLedger.expenses[0].currency).toBe('EUR');
    const parsed = budgetLedgerSchema.safeParse(rawLedger);
    if (!parsed.success) throw new Error(parsed.error.message);
    expect((await repository.get(trip.id))?.budgetLedger?.expenses[0]?.currency).toBe('EUR');
  });
});
