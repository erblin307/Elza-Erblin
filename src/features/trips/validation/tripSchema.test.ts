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
  it('accepts same-day dates and large whole-number groups', () => { expect(createTripSchema.safeParse({ ...validInput, endDate: validInput.startDate, travelers: 120 }).success).toBe(true); });
  it.each([0, -1, 1.5, Infinity, NaN])('rejects invalid traveler count %s', (travelers) => { expect(createTripSchema.safeParse({ ...validInput, travelers }).success).toBe(false); });
  it.each([0, -1, Infinity, NaN, 'invalid', ''])('rejects invalid budget %s', (amount) => { expect(createTripSchema.safeParse({ ...validInput, budget: { amount, currency: 'EUR' } }).success).toBe(false); });
  it('normalizes locations without rejecting matching names', () => {
    const result = createTripSchema.parse({ ...validInput, origin: '  Rome,   Italy ', destination: 'Rome, Italy' });
    expect(result.origin).toBe('Rome, Italy');
    expect(result.destination).toBe('Rome, Italy');
  });
  it('rejects meaningless location text', () => { expect(createTripSchema.safeParse({ ...validInput, origin: '123 !!!' }).success).toBe(false); });
  it('defaults pace and normalizes multi-selections', () => {
    const result = createTripSchema.parse({ ...validInput, preferences: { interests: ['food', 'history', 'food'], transportation: ['walking', 'walking'] } });
    expect(result.preferences.pace).toBe('balanced');
    expect(result.preferences.interests).toEqual(['history', 'food']);
    expect(result.preferences.transportation).toEqual(['walking']);
  });
  it('rejects unknown preferences and overlong notes', () => {
    expect(createTripSchema.safeParse({ ...validInput, preferences: { pace: 'fast' } }).success).toBe(false);
    expect(createTripSchema.safeParse({ ...validInput, preferences: { notes: 'a'.repeat(1001) } }).success).toBe(false);
  });
});
