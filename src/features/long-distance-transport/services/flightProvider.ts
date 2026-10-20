import { z } from 'zod';
import type { Trip } from '../../trips/types/trip';
import { journeyContext, plannedJourneySchema, type PlannedJourney, type TravelEvent } from '../domain/model';

export const cabinClasses = ['economy', 'premium_economy', 'business', 'first'] as const;
export type FlightEnvironment = 'test' | 'live';
export type Airport = { id: string; name: string; city?: string; iataCode: string; timeZone?: string; latitude?: number; longitude?: number };
export type FlightSegment = { id: string; operatingCarrier: string; marketingCarrier?: string; flightNumber?: string; departure: TravelEvent; arrival: TravelEvent; durationMinutes?: number; aircraft?: string };
export type FlightJourney = { segments: FlightSegment[]; departure: TravelEvent; arrival: TravelEvent; durationMinutes?: number; connectionCount: number };
export type BaggageInformation = { type: 'carry_on' | 'checked'; quantity?: number; weightKilograms?: number; description?: string };
export type FlightOffer = { id: string; provider: string; environment: FlightEnvironment; outbound: FlightJourney; returnJourney?: FlightJourney; totalPrice?: { amountMinor: number; currency: string; scope: 'total_party' }; baggage?: BaggageInformation[]; expiresAt?: string; retrievedAt: string; sourceReference?: string };
export type FlightSearchRequest = { origin: Airport; destination: Airport; journeyType: 'one_way' | 'round_trip'; outboundDate: string; returnDate?: string; adults: number; children: number; infants: number; cabinClass: (typeof cabinClasses)[number] };
export type FlightSearchResult = { offers: FlightOffer[]; environment: FlightEnvironment; limited: boolean; retrievedAt: string };
export type ReliableLayover = { airport?: string; minutes: number };

export interface FlightSearchProvider {
  readonly name: string;
  readonly configured: boolean;
  searchAirports(query: string, signal?: AbortSignal): Promise<Airport[]>;
  search(request: FlightSearchRequest, signal?: AbortSignal): Promise<FlightSearchResult>;
  getOffer?(offerId: string, signal?: AbortSignal): Promise<FlightOffer | null>;
}

export class FlightProviderError extends Error {
  constructor(public code: 'configuration' | 'auth' | 'rate-limit' | 'timeout' | 'network' | 'invalid-data' | 'validation', message: string) { super(message); this.name = 'FlightProviderError'; }
}

export function connectionLayovers(journey: FlightJourney): Array<ReliableLayover | undefined> {
  return journey.segments.slice(0, -1).map((segment, index) => {
    const next = journey.segments[index + 1];
    const arrival = segment.arrival.instant ? Date.parse(segment.arrival.instant) : Number.NaN;
    const departure = next?.departure.instant ? Date.parse(next.departure.instant) : Number.NaN;
    if (!Number.isFinite(arrival) || !Number.isFinite(departure) || departure < arrival) return undefined;
    return { airport: segment.arrival.airport?.iataCode, minutes: Math.round((departure - arrival) / 60_000) };
  });
}

const airportSchema = z.object({ id: z.string().min(1), name: z.string().min(1), city: z.string().optional(), iataCode: z.string().regex(/^[A-Z]{3}$/u), timeZone: z.string().optional(), latitude: z.number().finite().min(-90).max(90).optional(), longitude: z.number().finite().min(-180).max(180).optional() });
const eventSchema = z.object({ location: z.string().min(1), localDateTime: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/u), timeZone: z.string().optional(), utcOffset: z.string().optional(), instant: z.string().datetime({ offset: true }).optional(), airport: z.object({ name: z.string(), iataCode: z.string().regex(/^[A-Z]{3}$/u), providerId: z.string(), latitude: z.number().optional(), longitude: z.number().optional() }).optional() });
const segmentSchema = z.object({ id: z.string(), operatingCarrier: z.string(), marketingCarrier: z.string().optional(), flightNumber: z.string().optional(), departure: eventSchema, arrival: eventSchema, durationMinutes: z.number().int().nonnegative().optional(), aircraft: z.string().optional() });
const journeySchema = z.object({ segments: z.array(segmentSchema).min(1), departure: eventSchema, arrival: eventSchema, durationMinutes: z.number().int().nonnegative().optional(), connectionCount: z.number().int().nonnegative() });
export const flightOfferSchema = z.object({ id: z.string(), provider: z.string(), environment: z.enum(['test', 'live']), outbound: journeySchema, returnJourney: journeySchema.optional(), totalPrice: z.object({ amountMinor: z.number().int().nonnegative(), currency: z.string().regex(/^[A-Z]{3}$/u), scope: z.literal('total_party') }).optional(), baggage: z.array(z.object({ type: z.enum(['carry_on', 'checked']), quantity: z.number().int().nonnegative().optional(), weightKilograms: z.number().nonnegative().optional(), description: z.string().optional() })).optional(), expiresAt: z.string().datetime({ offset: true }).optional(), retrievedAt: z.string().datetime({ offset: true }), sourceReference: z.string().optional() });

export function validateFlightSearch(request: FlightSearchRequest) {
  airportSchema.parse(request.origin); airportSchema.parse(request.destination);
  if (request.origin.iataCode === request.destination.iataCode) throw new FlightProviderError('validation', 'Choose different departure and destination airports.');
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(request.outboundDate)) throw new FlightProviderError('validation', 'Choose a valid outbound date.');
  if (request.journeyType === 'round_trip' && (!request.returnDate || request.returnDate < request.outboundDate)) throw new FlightProviderError('validation', 'Choose a return date on or after the outbound date.');
  if (request.adults < 0 || request.children < 0 || request.infants < 0 || request.adults + request.children + request.infants < 1) throw new FlightProviderError('validation', 'Add at least one passenger.');
}

export class UnavailableFlightProvider implements FlightSearchProvider {
  readonly name = 'Duffel'; readonly configured = false;
  async searchAirports(): Promise<Airport[]> { throw new FlightProviderError('configuration', 'Live flight search is not configured. Add journeys manually or configure a secured server-side Duffel endpoint.'); }
  async search(): Promise<FlightSearchResult> { throw new FlightProviderError('configuration', 'Live flight search is not configured. Add journeys manually or configure a secured server-side Duffel endpoint.'); }
}

export class SecureEndpointFlightProvider implements FlightSearchProvider {
  readonly name = 'Duffel'; readonly configured = true;
  private pending = new Map<string, Promise<unknown>>(); private calls: number[] = [];
  constructor(private endpoint: string, private fetcher: typeof fetch = (...args) => fetch(...args)) {}
  private async request(path: string, body: unknown, signal?: AbortSignal) {
    const key = `${path}:${JSON.stringify(body)}`;
    const existing = this.pending.get(key); if (existing) return existing;
    this.calls = this.calls.filter((time) => time > Date.now() - 60_000);
    if (this.calls.length >= 10) throw new FlightProviderError('rate-limit', 'Flight search limit reached. Wait before trying again.');
    this.calls.push(Date.now());
    const controller = new AbortController(); let timedOut = false;
    const cancel = () => controller.abort(); signal?.addEventListener('abort', cancel, { once: true });
    const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 25_000);
    const operation = (async () => {
      try {
        const response = await this.fetcher(`${this.endpoint.replace(/\/$/u, '')}/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body), signal: controller.signal });
        if (response.status === 401 || response.status === 403) throw new FlightProviderError('auth', 'The secured flight provider endpoint rejected this request.');
        if (response.status === 429) throw new FlightProviderError('rate-limit', 'The flight provider is rate limiting searches. Wait before retrying.');
        if (!response.ok) throw new FlightProviderError('network', 'The flight provider is temporarily unavailable. Manual planning remains available.');
        try { return await response.json(); } catch { throw new FlightProviderError('invalid-data', 'The flight provider returned malformed JSON.'); }
      } catch (error) {
        if (timedOut) throw new FlightProviderError('timeout', 'Flight search timed out. Try again or add the journey manually.');
        if (signal?.aborted) throw new DOMException('Search canceled.', 'AbortError');
        if (error instanceof FlightProviderError) throw error;
        throw new FlightProviderError('network', 'The flight provider could not be reached. Manual planning remains available.');
      } finally { clearTimeout(timeout); signal?.removeEventListener('abort', cancel); this.pending.delete(key); }
    })();
    this.pending.set(key, operation); return operation;
  }
  async searchAirports(query: string, signal?: AbortSignal) {
    if (query.trim().length < 2) return [];
    const value = await this.request('airports', { query: query.trim() }, signal);
    const parsed = z.object({ airports: z.array(airportSchema).max(30) }).safeParse(value);
    if (!parsed.success) throw new FlightProviderError('invalid-data', 'Airport lookup returned unusable data.');
    return parsed.data.airports;
  }
  async search(request: FlightSearchRequest, signal?: AbortSignal) {
    validateFlightSearch(request);
    const value = await this.request('offers', request, signal);
    const parsed = z.object({ offers: z.array(flightOfferSchema).max(100), environment: z.enum(['test', 'live']), limited: z.boolean().default(true), retrievedAt: z.string().datetime({ offset: true }) }).safeParse(value);
    if (!parsed.success || parsed.data.offers.some((offer) => offer.environment !== parsed.data.environment)) throw new FlightProviderError('invalid-data', 'Flight search returned inconsistent offer data.');
    return parsed.data;
  }
}

export const flightProvider: FlightSearchProvider = import.meta.env.VITE_FLIGHT_SEARCH_ENDPOINT?.trim() ? new SecureEndpointFlightProvider(import.meta.env.VITE_FLIGHT_SEARCH_ENDPOINT.trim()) : new UnavailableFlightProvider();

export function offerToPlannedJourneys(trip: Trip, offer: FlightOffer, now = new Date().toISOString(), makeId: () => string = () => `journey-${crypto.randomUUID()}`): PlannedJourney[] {
  const group = `offer-${offer.provider}-${offer.id}`;
  const base = { tripId: trip.id, mode: 'flight' as const, source: 'provider' as const, status: 'planned' as const, context: journeyContext(trip), provider: offer.provider, providerEnvironment: offer.environment, providerOfferId: offer.id, offerGroupId: group, selectedAt: now, updatedAt: now };
  const cost = offer.totalPrice ? { identity: group, amount: offer.totalPrice.amountMinor / 100, currency: offer.totalPrice.currency, provenance: 'provider_offer' as const, scope: offer.returnJourney ? 'round_trip' as const : 'journey' as const, ...(offer.expiresAt ? { validUntil: offer.expiresAt } : {}) } : undefined;
  const journeys: PlannedJourney[] = [plannedJourneySchema.parse({ ...base, id: makeId(), direction: 'outbound', departure: offer.outbound.departure, arrival: offer.outbound.arrival, operator: offer.outbound.segments.map((segment) => segment.operatingCarrier).filter((value, index, all) => all.indexOf(value) === index).join(', '), serviceNumber: offer.outbound.segments.map((segment) => segment.flightNumber).filter(Boolean).join(', ') || undefined, cost })];
  if (offer.returnJourney) journeys.push(plannedJourneySchema.parse({ ...base, id: makeId(), direction: 'return', departure: offer.returnJourney.departure, arrival: offer.returnJourney.arrival, operator: offer.returnJourney.segments.map((segment) => segment.operatingCarrier).filter((value, index, all) => all.indexOf(value) === index).join(', '), serviceNumber: offer.returnJourney.segments.map((segment) => segment.flightNumber).filter(Boolean).join(', ') || undefined }));
  return journeys;
}
