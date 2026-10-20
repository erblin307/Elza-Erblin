import { describe, expect, it } from 'vitest';
import { createManualJourney, eventInstant, journeyExpired, journeyNeedsReview } from '../domain/model';
import { scheduleIssues, travelConstraints } from '../domain/schedule';
import { normalizeDuffelOffer } from '../services/duffelNormalization';
import { connectionLayovers, SecureEndpointFlightProvider, UnavailableFlightProvider, validateFlightSearch, type Airport, type FlightJourney } from '../services/flightProvider';
import { generateItinerary } from '../../itinerary/domain/generator';
import { candidatePool, generationOptions, testTrip } from '../../itinerary/tests/testData';

const airport = (iataCode: string): Airport => ({ id: `airport-${iataCode}`, name: `${iataCode} Airport`, iataCode, timeZone: 'Europe/Rome' });
const place = (code: string, zone = 'Europe/Rome') => ({ id: `arp_${code}`, name: `${code} Airport`, iata_code: code, time_zone: zone, latitude: 42, longitude: 12 });
const rawSegment = (id: string, origin: ReturnType<typeof place>, destination: ReturnType<typeof place>, departing: string, arriving: string) => ({ id, departing_at: departing, arriving_at: arriving, origin, destination, operating_carrier: { name: 'Test Carrier' }, marketing_carrier: { name: 'Test Carrier' }, operating_carrier_flight_number: '123', duration: 'PT2H15M', aircraft: null });
const rawOffer = (roundTrip = false, live = false) => ({ id: 'off_1', live_mode: live, slices: [{ duration: 'PT4H30M', segments: [rawSegment('seg_1', place('PRN', 'Europe/Belgrade'), place('VIE', 'Europe/Vienna'), '2027-06-12T08:00:00', '2027-06-12T09:30:00'), rawSegment('seg_2', place('VIE', 'Europe/Vienna'), place('FCO'), '2027-06-12T11:00:00', '2027-06-12T12:15:00')] }, ...(roundTrip ? [{ duration: 'PT2H15M', segments: [rawSegment('seg_3', place('FCO'), place('PRN', 'Europe/Belgrade'), '2027-06-17T18:00:00', '2027-06-17T20:15:00')] }] : [])], total_amount: '250.40', total_currency: 'EUR', expires_at: '2027-06-01T10:30:00Z', created_at: '2027-06-01T10:00:00Z', baggage_allowances: [{ type: 'carry_on', quantity: 1 }] });

describe('flight offer normalization and provider boundary', () => {
  it('normalizes one-way multi-segment offers without inventing layovers', () => {
    const offer = normalizeDuffelOffer(rawOffer());
    expect(offer.environment).toBe('test'); expect(offer.outbound.segments).toHaveLength(2); expect(offer.outbound.connectionCount).toBe(1);
    expect(offer.outbound.durationMinutes).toBe(270); expect(offer.returnJourney).toBeUndefined(); expect(offer.totalPrice).toEqual({ amountMinor: 25040, currency: 'EUR', scope: 'total_party' });
    expect(offer.baggage).toEqual([{ type: 'carry_on', quantity: 1 }]);
  });
  it('normalizes round-trip and live environment exactly as provider data states', () => {
    const offer = normalizeDuffelOffer(rawOffer(true, true));
    expect(offer.environment).toBe('live'); expect(offer.returnJourney?.segments).toHaveLength(1); expect(offer.expiresAt).toBe('2027-06-01T10:30:00Z');
  });
  it('keeps missing baggage and price absent', () => {
    const raw = rawOffer(); delete (raw as Partial<typeof raw>).baggage_allowances; delete (raw as Partial<typeof raw>).total_amount;
    const offer = normalizeDuffelOffer(raw); expect(offer.baggage).toBeUndefined(); expect(offer.totalPrice).toBeUndefined();
  });
  it('calculates layovers only from reliable absolute instants', () => {
    const offer = normalizeDuffelOffer(rawOffer());
    expect(connectionLayovers(offer.outbound)).toEqual([undefined]);
    const journey = structuredClone(offer.outbound) as FlightJourney;
    journey.segments[0]!.arrival.instant = '2027-06-12T07:30:00Z';
    journey.segments[1]!.departure.instant = '2027-06-12T09:00:00Z';
    expect(connectionLayovers(journey)).toEqual([{ airport: 'VIE', minutes: 90 }]);
  });
  it('rejects malformed provider data', () => expect(() => normalizeDuffelOffer({ ...rawOffer(), slices: [] })).toThrow());
  it('validates airports, journey type, dates and passenger count', () => {
    const base = { origin: airport('PRN'), destination: airport('FCO'), journeyType: 'round_trip' as const, outboundDate: '2027-06-12', returnDate: '2027-06-17', adults: 2, children: 0, infants: 0, cabinClass: 'economy' as const };
    expect(() => validateFlightSearch(base)).not.toThrow();
    expect(() => validateFlightSearch({ ...base, destination: airport('PRN') })).toThrow('different');
    expect(() => validateFlightSearch({ ...base, returnDate: '2027-06-11' })).toThrow('return');
    expect(() => validateFlightSearch({ ...base, adults: 0 })).toThrow('passenger');
  });
  it('exposes missing configuration honestly', async () => await expect(new UnavailableFlightProvider().search()).rejects.toMatchObject({ code: 'configuration' }));
  it.each([[429, 'rate-limit'], [401, 'auth'], [500, 'network']] as const)('maps HTTP %s to %s', async (status, code) => {
    const provider = new SecureEndpointFlightProvider('/api/flights', async () => new Response('{}', { status }));
    await expect(provider.searchAirports('Rome')).rejects.toMatchObject({ code });
  });
  it('rejects malformed endpoint responses and accepts empty results', async () => {
    const malformed = new SecureEndpointFlightProvider('/api/flights', async () => new Response('{oops', { status: 200 }));
    await expect(malformed.searchAirports('Rome')).rejects.toMatchObject({ code: 'invalid-data' });
    const empty = new SecureEndpointFlightProvider('/api/flights', async () => Response.json({ airports: [] }));
    await expect(empty.searchAirports('Rome')).resolves.toEqual([]);
  });
});

describe('timezone-safe manual journeys and schedule impact', () => {
  it('normalizes known offsets into absolute instants across timezones and overnight dates', () => {
    const departure = { location: 'New York', localDateTime: '2027-12-31T22:30', utcOffset: '-05:00' };
    const arrival = { location: 'Rome', localDateTime: '2028-01-01T12:30', utcOffset: '+01:00' };
    expect((eventInstant(arrival) ?? 0) - (eventInstant(departure) ?? 0)).toBe(8 * 60 * 60 * 1000);
  });
  it('does not convert unknown-offset local times through the browser timezone', () => expect(eventInstant({ location: 'Station', localDateTime: '2027-06-12T09:00' })).toBeUndefined());
  it('rejects known-instant arrival before departure but preserves timezone uncertainty', () => {
    expect(() => createManualJourney(testTrip, { direction: 'outbound', mode: 'train', departureLocation: 'A', arrivalLocation: 'B', departureLocalDateTime: '2027-06-12T12:00', arrivalLocalDateTime: '2027-06-12T11:00', departureUtcOffset: '+02:00', arrivalUtcOffset: '+02:00' }, 'j1')).toThrow('Arrival');
    expect(() => createManualJourney(testTrip, { direction: 'outbound', mode: 'train', departureLocation: 'A', arrivalLocation: 'B', departureLocalDateTime: '2027-06-12T12:00', arrivalLocalDateTime: '2027-06-12T11:00' }, 'j2')).not.toThrow();
  });
  it('finds arrival and departure conflicts without changing itinerary activities', () => {
    const outbound = createManualJourney(testTrip, { direction: 'outbound', mode: 'train', departureLocation: 'Prishtina', arrivalLocation: 'Rome', departureLocalDateTime: '2027-06-12T10:00', arrivalLocalDateTime: '2027-06-12T16:00' }, 'out');
    const returning = createManualJourney(testTrip, { direction: 'return', mode: 'bus', departureLocation: 'Rome', arrivalLocation: 'Prishtina', departureLocalDateTime: '2027-06-14T10:00', arrivalLocalDateTime: '2027-06-14T18:00' }, 'back');
    const trip = { ...testTrip, longDistanceTravel: { version: 1 as const, journeys: [outbound, returning] } };
    const before = structuredClone(trip.itinerary);
    expect(travelConstraints(trip)).toMatchObject({ arrival: { minute: 960 }, departure: { minute: 600 } });
    const issues = scheduleIssues(trip, [{ id: 'd1', date: '2027-06-12', provisional: true, breaks: [], items: [{ id: 'i1', activityId: 'a', dayId: 'd1', order: 0, startMinute: 600, endMinute: 660, durationAssumed: false, manuallyAdded: false, reasons: [] }] }, { id: 'd3', date: '2027-06-14', provisional: true, breaks: [], items: [{ id: 'i2', activityId: 'b', dayId: 'd3', order: 0, startMinute: 600, endMinute: 720, durationAssumed: false, manuallyAdded: false, reasons: [] }] }]);
    expect(issues.filter((issue) => issue.kind === 'conflict')).toHaveLength(2); expect(trip.itinerary).toEqual(before);
  });
  it('marks changed routes/travelers for review and detects expiry', () => {
    const journey = createManualJourney(testTrip, { direction: 'outbound', mode: 'flight', departureLocation: 'A', arrivalLocation: 'B', departureLocalDateTime: '2027-06-12T10:00' }, 'j');
    expect(journeyNeedsReview({ ...testTrip, travelers: 3 }, journey)).toBe(true);
    expect(journeyExpired({ ...journey, cost: { identity: 'c', amount: 10, currency: 'EUR', provenance: 'provider_offer', scope: 'journey', validUntil: '2020-01-01T00:00:00Z' } })).toBe(true);
  });
  it('constrains generated first and last day schedules without deleting activities', () => {
    const outbound = createManualJourney(testTrip, { direction: 'outbound', mode: 'flight', departureLocation: 'Prishtina', arrivalLocation: 'Rome', departureLocalDateTime: '2027-06-12T10:00', arrivalLocalDateTime: '2027-06-12T16:00' }, 'out');
    const returning = createManualJourney(testTrip, { direction: 'return', mode: 'flight', departureLocation: 'Rome', arrivalLocation: 'Prishtina', departureLocalDateTime: '2027-06-14T10:00', arrivalLocalDateTime: '2027-06-14T12:00' }, 'back');
    const trip = { ...testTrip, longDistanceTravel: { version: 1 as const, journeys: [outbound, returning] } };
    const itinerary = generateItinerary(trip, candidatePool(), generationOptions);
    expect(itinerary.days[0]!.items.every((item) => item.startMinute >= 960)).toBe(true);
    expect(itinerary.days.at(-1)!.items.every((item) => item.endMinute <= 600)).toBe(true);
    expect(itinerary.metadata.warnings.join(' ')).toContain('constrain boundary-day');
  });
});
