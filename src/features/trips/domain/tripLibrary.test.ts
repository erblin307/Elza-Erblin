import { describe, expect, it } from 'vitest';
import type { Trip } from '../types/trip';
import { normalizedTripSearch, tripLifecycle, visibleTrips } from './tripLibrary';

const base: Trip = { id: 'rome', title: 'Róme family trip', origin: 'Prishtina', destination: 'Rome, Italy', startDate: '2027-06-12', endDate: '2027-06-17', travelers: 2, budget: { amount: 1500, currency: 'EUR' }, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-03-01T00:00:00.000Z' };
const vienna: Trip = { ...base, id: 'vienna', title: 'Vienna trip', destination: 'Vienna', startDate: '2027-05-01', endDate: '2027-05-04', createdAt: '2026-02-01T00:00:00.000Z', updatedAt: '2026-02-01T00:00:00.000Z' };
const past: Trip = { ...base, id: 'past', title: 'Old journey', destination: 'Athens', startDate: '2025-01-01', endDate: '2025-01-03', updatedAt: '2026-04-01T00:00:00.000Z' };

describe('trip library projection', () => {
  it('normalizes local title, destination and origin search', () => {
    expect(normalizedTripSearch('  RÓME  ')).toBe('rome');
    expect(visibleTrips([base, vienna], 'rome', 'all', 'updated', '2026-10-20').map((trip) => trip.id)).toEqual(['rome']);
    expect(visibleTrips([base, vienna], 'prishtina', 'all', 'updated', '2026-10-20')).toHaveLength(2);
  });

  it('filters only defined lifecycle states', () => {
    expect(tripLifecycle(base, '2027-06-14')).toBe('in_progress');
    expect(visibleTrips([base, vienna, past], '', 'past', 'updated', '2026-10-20').map((trip) => trip.id)).toEqual(['past']);
  });

  it('sorts a view without mutating repository order', () => {
    const original = [base, vienna, past];
    expect(visibleTrips(original, '', 'all', 'upcoming', '2026-10-20').map((trip) => trip.id)).toEqual(['vienna', 'rome', 'past']);
    expect(visibleTrips(original, '', 'all', 'destination', '2026-10-20').map((trip) => trip.destination)).toEqual(['Athens', 'Rome, Italy', 'Vienna']);
    expect(original.map((trip) => trip.id)).toEqual(['rome', 'vienna', 'past']);
  });
});
