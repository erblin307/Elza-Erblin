import { describe, expect, it } from 'vitest';
import { createTripSchema } from './tripSchema';

const validInput = { origin: 'Pristina', destination: 'Vienna', startDate: '2027-04-02', endDate: '2027-04-08', travelers: 2, budget: { amount: 1200, currency: 'EUR' } };

describe('createTripSchema', () => {
  it('accepts a complete valid trip', () => { expect(createTripSchema.safeParse(validInput).success).toBe(true); });
  it('rejects empty route fields', () => { expect(createTripSchema.safeParse({ ...validInput, origin: '  ', destination: '' }).success).toBe(false); });
  it('rejects impossible dates', () => { expect(createTripSchema.safeParse({ ...validInput, startDate: '2027-02-30' }).success).toBe(false); });
  it('requires the end date to be on or after the start date', () => {
    const result = createTripSchema.safeParse({ ...validInput, startDate: '2027-04-08', endDate: '2027-04-02' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.flatten().fieldErrors.endDate).toContain('End date must be on or after the start date.');
  });
  it('rejects invalid travelers, budget, and currency', () => { expect(createTripSchema.safeParse({ ...validInput, travelers: 0, budget: { amount: -1, currency: 'BTC' } }).success).toBe(false); });
});
