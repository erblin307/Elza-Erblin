import type { Trip } from '../../trips/types/trip';
import type { ActivityCandidate } from '../types/itinerary';
import type { GenerationOptions } from '../domain/generator';

export const testTrip: Trip = { id: 'test-trip', title: 'Rome trip', origin: 'Prishtina', destination: 'Rome', startDate: '2027-06-12', endDate: '2027-06-14', travelers: 2, budget: { amount: 1500, currency: 'EUR' }, preferences: { accommodation: 'hotel', transportation: ['walking'], interests: ['history', 'food', 'architecture'], pace: 'balanced' }, createdAt: '2026-10-14T00:00:00.000Z', updatedAt: '2026-10-14T00:00:00.000Z' };
export const generationOptions: GenerationOptions = { dataMode: 'live', sourceLabel: 'Unit test provider', generatedAt: '2026-10-14T00:00:00.000Z' };
export function candidate(id: string, changes: Partial<ActivityCandidate> = {}): ActivityCandidate {
  return { id, name: `Test activity ${id}`, destination: 'rome', categories: ['history'], durationMinutes: 45, source: 'provider', sourceName: 'Unit test provider', price: { amount: 0, currency: 'EUR', unit: 'group', basis: 'source_estimate' }, ...changes };
}
export function candidatePool(count = 42) {
  return Array.from({ length: count }, (_, index) => candidate(`activity-${String(index).padStart(2, '0')}`, { categories: [['history'], ['food'], ['architecture']][index % 3] as ActivityCandidate['categories'] }));
}
