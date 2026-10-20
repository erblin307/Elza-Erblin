import { describe, expect, it } from 'vitest';
import { calculateBudget } from '../domain/engine';
import { createManualExpense, updateManualExpense } from '../domain/model';
import { createBudgetTrip } from './testData';

const now = '2026-10-20T00:00:00.000Z';

describe('budget engine', () => {
  it('combines party-aware itinerary estimates and manual expenses once', () => {
    const trip = createBudgetTrip();
    const dinner = createManualExpense(trip, { title: 'Dinner', amount: 40, category: 'food', certainty: 'confirmed', date: trip.startDate, note: '' }, 'dinner', now);
    const snapshot = calculateBudget({ ...trip, budgetLedger: { version: 1, expenses: [dinner] } });
    expect(snapshot.categoryTotals.activities).toBe(110);
    expect(snapshot.categoryTotals.food).toBe(40);
    expect(snapshot.total).toBe(150);
    expect(snapshot.remaining).toBe(350);
    expect(snapshot.confirmedTotal).toBe(40);
    expect(snapshot.estimatedTotal).toBe(110);
  });

  it('reports over-budget amounts and safe usage thresholds', () => {
    const trip = createBudgetTrip();
    const large = createManualExpense(trip, { title: 'Shopping', amount: 450, category: 'shopping', certainty: 'confirmed', date: '', note: '' }, 'large', now);
    const snapshot = calculateBudget({ ...trip, budgetLedger: { version: 1, expenses: [large] } });
    expect(snapshot.total).toBe(560);
    expect(snapshot.overBy).toBe(60);
    expect(snapshot.status).toBe('over');
    expect(snapshot.insights[0]).toContain('exceeds');
    expect(calculateBudget({ ...trip, budget: { ...trip.budget, amount: 0 } }).usagePercent).toBe(0);
  });

  it('updates automatically when an itinerary activity is removed', () => {
    const trip = createBudgetTrip();
    const before = calculateBudget(trip);
    const expensive = trip.itinerary!.days.flatMap((day) => day.items).find((item) => item.activityId === 'tour')!;
    const days = trip.itinerary!.days.map((day) => ({ ...day, items: day.items.filter((item) => item.id !== expensive.id).map((item, order) => ({ ...item, order })) }));
    const after = calculateBudget({ ...trip, itinerary: { ...trip.itinerary!, days } });
    expect(before.categoryTotals.activities - after.categoryTotals.activities).toBe(60);
  });

  it('preserves but excludes an outdated itinerary after Trip context changes', () => {
    const trip = createBudgetTrip();
    const snapshot = calculateBudget({ ...trip, destination: 'Vienna' });
    expect(snapshot.categoryTotals.activities).toBe(0);
    expect(snapshot.coverage.find((item) => item.source === 'activities')).toMatchObject({ status: 'unavailable' });
    expect(snapshot.coverage.find((item) => item.source === 'activities')?.detail).toContain('outdated');
  });

  it('does not invent accommodation or route costs', () => {
    const snapshot = calculateBudget(createBudgetTrip());
    expect(snapshot.expenses.every((expense) => expense.source !== ('accommodation' as never) && expense.source !== ('routing' as never))).toBe(true);
    expect(snapshot.coverage.find((item) => item.source === 'transportation')?.detail).toMatch(/not fares|No priced/);
    expect(snapshot.coverage.find((item) => item.source === 'accommodation')?.status).toBe('not-planned');
  });

  it('excludes manual expenses saved in another currency without converting them', () => {
    const trip = createBudgetTrip();
    const dinner = createManualExpense(trip, { title: 'Dinner', amount: 40, category: 'food', certainty: 'confirmed', date: '', note: '' }, 'dinner', now);
    const snapshot = calculateBudget({ ...trip, budget: { amount: 500, currency: 'USD' }, budgetLedger: { version: 1, expenses: [dinner] } });
    expect(snapshot.categoryTotals.food).toBe(0);
    expect(snapshot.unknownSourceCount).toBeGreaterThan(0);
  });

  it('requires an explicit edit to re-enter an old-currency expense in the Trip currency', () => {
    const trip = createBudgetTrip();
    const dinner = createManualExpense(trip, { title: 'Dinner', amount: 40, category: 'food', certainty: 'confirmed', date: '', note: '' }, 'dinner', now);
    const updated = updateManualExpense(dinner, { title: 'Dinner', amount: 44, category: 'food', certainty: 'confirmed', date: '', note: '' }, 'USD', now);
    expect(updated.amount).toBe(44);
    expect(updated.currency).toBe('USD');
  });

  it('allocates only dated costs to trip days without double-counting overall totals', () => {
    const trip = createBudgetTrip();
    const undated = createManualExpense(trip, { title: 'Pass', amount: 20, category: 'transportation', certainty: 'estimated', date: '', note: '' }, 'pass', now);
    const snapshot = calculateBudget({ ...trip, budgetLedger: { version: 1, expenses: [undated] } });
    expect(snapshot.dailyTotals.reduce((sum, day) => sum + day.total, 0)).toBe(snapshot.total - 20);
    expect(snapshot.unallocatedExpenseCount).toBe(1);
  });
});
