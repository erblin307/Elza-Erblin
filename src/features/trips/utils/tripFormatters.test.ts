import { describe, expect, it } from 'vitest';
import { durationLabel, tripDuration } from './tripFormatters';

describe('calendar duration', () => {
  it('counts inclusive days and overnight stays', () => {
    expect(tripDuration('2027-06-12', '2027-06-17')).toBe(6);
    expect(durationLabel('2027-06-12', '2027-06-17')).toBe('6 calendar days / 5 nights');
  });
  it('supports a same-day trip with zero nights', () => { expect(durationLabel('2027-06-12', '2027-06-12')).toBe('1 calendar day / 0 nights'); });
  it('counts across leap days and daylight-saving boundaries', () => {
    expect(tripDuration('2028-02-28', '2028-03-01')).toBe(3);
    expect(tripDuration('2027-03-27', '2027-03-29')).toBe(3);
  });
});
