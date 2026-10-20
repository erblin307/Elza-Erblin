import { generateItinerary } from '../../itinerary/domain/generator';
import { candidate, generationOptions, testTrip } from '../../itinerary/tests/testData';
import type { Trip } from '../../trips/types/trip';

export function createBudgetTrip(): Trip {
  const itinerary = generateItinerary(testTrip, [
    candidate('museum', { name: 'Museum ticket', price: { amount: 25, currency: 'EUR', unit: 'person', basis: 'source_estimate' } }),
    candidate('tour', { name: 'Private tour', price: { amount: 60, currency: 'EUR', unit: 'group', basis: 'source_estimate' } }),
    candidate('unknown', { name: 'Unpriced landmark', price: undefined }),
  ], { ...generationOptions, activityAllowance: 300 });
  return { ...testTrip, budget: { amount: 500, currency: 'EUR' }, itinerary };
}
