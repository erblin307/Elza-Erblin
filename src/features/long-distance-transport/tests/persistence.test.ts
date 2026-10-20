import { beforeEach, describe, expect, it } from 'vitest';
import { calculateBudget } from '../../budget/domain/engine';
import { createManualExpense } from '../../budget/domain/model';
import { LocalStorageTripRepository } from '../../trips/services/LocalStorageTripRepository';
import { testTrip } from '../../itinerary/tests/testData';
import { createManualJourney } from '../domain/model';
import { offerToPlannedJourneys, type FlightOffer } from '../services/flightProvider';

const now = '2026-10-20T10:00:00.000Z';
const event = (location: string, localDateTime: string) => ({ location, localDateTime, utcOffset: '+02:00' });
const offer = (expiresAt = '2027-06-12T08:00:00Z'): FlightOffer => ({ id: 'off-round', provider: 'Duffel', environment: 'test', outbound: { segments: [{ id: 's1', operatingCarrier: 'Sandbox Air', departure: event('PRN', '2027-06-12T08:00'), arrival: event('FCO', '2027-06-12T10:00') }], departure: event('PRN', '2027-06-12T08:00'), arrival: event('FCO', '2027-06-12T10:00'), connectionCount: 0 }, returnJourney: { segments: [{ id: 's2', operatingCarrier: 'Sandbox Air', departure: event('FCO', '2027-06-14T18:00'), arrival: event('PRN', '2027-06-14T20:00') }], departure: event('FCO', '2027-06-14T18:00'), arrival: event('PRN', '2027-06-14T20:00'), connectionCount: 0 }, totalPrice: { amountMinor: 25000, currency: 'EUR', scope: 'total_party' }, expiresAt, retrievedAt: now });

describe('long-distance journey persistence and Budget integration', () => {
  beforeEach(() => localStorage.clear());
  it('adds, edits, replaces, removes and reloads manual journeys with Trip isolation', async () => {
    const repository = new LocalStorageTripRepository(localStorage); const trip = await repository.create(testTrip); const other = await repository.create({ ...testTrip, destination: 'Vienna' });
    const train = createManualJourney(trip, { direction: 'outbound', mode: 'train', departureLocation: 'Prishtina station', arrivalLocation: 'Rome station', departureLocalDateTime: '2027-06-12T06:00', arrivalLocalDateTime: '2027-06-12T15:00', estimatedCost: 45, currency: 'EUR' }, 'train', now);
    const saved = await repository.saveLongDistanceTravel(trip.id, { version: 1, journeys: [train] }, trip.updatedAt);
    expect((await new LocalStorageTripRepository(localStorage).get(trip.id))?.longDistanceTravel?.journeys[0]?.mode).toBe('train');
    const bus = createManualJourney(saved, { direction: 'return', mode: 'bus', departureLocation: 'Rome', arrivalLocation: 'Prishtina', departureLocalDateTime: '2027-06-14T08:00' }, 'bus', now);
    const replaced = await repository.saveLongDistanceTravel(trip.id, { version: 1, journeys: [bus] }, saved.updatedAt);
    expect(replaced.longDistanceTravel?.journeys.map((journey) => journey.id)).toEqual(['bus']);
    expect((await repository.get(other.id))?.longDistanceTravel).toBeUndefined();
    const removed = await repository.saveLongDistanceTravel(trip.id, { version: 1, journeys: [] }, replaced.updatedAt);
    expect(removed.longDistanceTravel?.journeys).toEqual([]);
  });
  it('rejects cross-Trip ownership and stale tab writes', async () => {
    const repository = new LocalStorageTripRepository(localStorage); const trip = await repository.create(testTrip);
    const journey = createManualJourney(trip, { direction: 'outbound', mode: 'flight', departureLocation: 'A', arrivalLocation: 'B', departureLocalDateTime: '2027-06-12T06:00' }, 'j', now);
    await expect(repository.saveLongDistanceTravel(trip.id, { version: 1, journeys: [{ ...journey, tripId: 'other' }] })).rejects.toThrow('another trip');
    const otherTab = new LocalStorageTripRepository(localStorage); const changed = await otherTab.update(trip.id, { ...trip, travelers: 3 });
    expect(changed.travelers).toBe(3); await expect(repository.saveLongDistanceTravel(trip.id, { version: 1, journeys: [journey] }, trip.updatedAt)).rejects.toThrow('another browser tab');
  });
  it('duplicates journeys with fresh Trip/journey/cost identities', async () => {
    const repository = new LocalStorageTripRepository(localStorage); const trip = await repository.create(testTrip); const journey = createManualJourney(trip, { direction: 'outbound', mode: 'train', departureLocation: 'A', arrivalLocation: 'B', departureLocalDateTime: '2027-06-12T06:00', estimatedCost: 30, currency: 'EUR' }, 'journey-old', now); const saved = await repository.saveLongDistanceTravel(trip.id, { version: 1, journeys: [journey] });
    const copy = await repository.duplicate(saved.id); expect(copy.longDistanceTravel?.journeys[0]?.tripId).toBe(copy.id); expect(copy.longDistanceTravel?.journeys[0]?.id).not.toBe('journey-old'); expect(copy.longDistanceTravel?.journeys[0]?.cost?.identity).not.toBe(journey.cost?.identity);
  });
  it('counts one valid round-trip offer once and excludes expired/provider-mismatched costs', () => {
    let sequence = 0; const current = { ...testTrip, longDistanceTravel: { version: 1 as const, journeys: offerToPlannedJourneys(testTrip, offer(), now, () => `j${++sequence}`) } };
    expect(calculateBudget(current).categoryTotals.transportation).toBe(250);
    sequence = 0; const expired = { ...testTrip, longDistanceTravel: { version: 1 as const, journeys: offerToPlannedJourneys(testTrip, offer('2020-01-01T00:00:00Z'), now, () => `e${++sequence}`) } };
    expect(calculateBudget(expired).categoryTotals.transportation).toBe(0);
    expect(calculateBudget({ ...current, travelers: 3 }).categoryTotals.transportation).toBe(0);
  });
  it('reconciles a planned estimate with a real manual payment without deleting the payment', () => {
    const base = createManualJourney(testTrip, { direction: 'outbound', mode: 'train', departureLocation: 'A', arrivalLocation: 'B', departureLocalDateTime: '2027-06-12T06:00', estimatedCost: 50, currency: 'EUR' }, 'train', now);
    const actual = createManualExpense(testTrip, { title: 'Train paid', amount: 55, category: 'transportation', certainty: 'confirmed', date: testTrip.startDate, note: '' }, 'paid', now);
    const journey = { ...base, cost: { ...base.cost!, reconciledExpenseId: actual.id } };
    const trip = { ...testTrip, longDistanceTravel: { version: 1 as const, journeys: [journey] }, budgetLedger: { version: 1 as const, expenses: [actual] } };
    const snapshot = calculateBudget(trip); expect(snapshot.categoryTotals.transportation).toBe(55); expect(snapshot.confirmedTotal).toBe(55);
  });
});
