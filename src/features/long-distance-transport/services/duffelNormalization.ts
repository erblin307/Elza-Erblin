import { z } from 'zod';
import { flightOfferSchema, type FlightOffer, type FlightJourney, type FlightSegment } from './flightProvider';

const place = z.object({ id: z.string(), name: z.string(), iata_code: z.string().regex(/^[A-Z]{3}$/u), time_zone: z.string().optional(), latitude: z.number().optional(), longitude: z.number().optional() });
const carrier = z.object({ name: z.string() });
const segment = z.object({ id: z.string(), departing_at: z.string(), arriving_at: z.string(), origin: place, destination: place, operating_carrier: carrier, marketing_carrier: carrier.optional(), operating_carrier_flight_number: z.string().optional(), marketing_carrier_flight_number: z.string().optional(), duration: z.string().optional(), aircraft: z.object({ name: z.string() }).nullable().optional() });
const slice = z.object({ segments: z.array(segment).min(1), duration: z.string().optional() });
const baggage = z.object({ type: z.enum(['carry_on', 'checked']), quantity: z.number().int().nonnegative().optional() });
const offer = z.object({ id: z.string(), live_mode: z.boolean(), slices: z.array(slice).min(1).max(2), total_amount: z.string().optional(), total_currency: z.string().regex(/^[A-Z]{3}$/u).optional(), expires_at: z.string().optional(), created_at: z.string(), passenger_identity_documents_required: z.boolean().optional(), supported_passenger_identity_document_types: z.array(z.string()).optional(), baggage_allowances: z.array(baggage).optional() });

function durationMinutes(value?: string) {
  if (!value) return undefined;
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?$/u.exec(value);
  return match ? Number(match[1] ?? 0) * 60 + Number(match[2] ?? 0) : undefined;
}
function local(value: string) { return value.slice(0, 16); }
function event(raw: z.infer<typeof place>, value: string) {
  return { location: `${raw.name} (${raw.iata_code})`, localDateTime: local(value), ...(raw.time_zone ? { timeZone: raw.time_zone } : {}), airport: { name: raw.name, iataCode: raw.iata_code, providerId: raw.id, ...(raw.latitude !== undefined ? { latitude: raw.latitude } : {}), ...(raw.longitude !== undefined ? { longitude: raw.longitude } : {}) } };
}
function normalizeSegment(raw: z.infer<typeof segment>): FlightSegment {
  return { id: raw.id, operatingCarrier: raw.operating_carrier.name, ...(raw.marketing_carrier ? { marketingCarrier: raw.marketing_carrier.name } : {}), ...(raw.operating_carrier_flight_number || raw.marketing_carrier_flight_number ? { flightNumber: raw.operating_carrier_flight_number ?? raw.marketing_carrier_flight_number } : {}), departure: event(raw.origin, raw.departing_at), arrival: event(raw.destination, raw.arriving_at), ...(durationMinutes(raw.duration) !== undefined ? { durationMinutes: durationMinutes(raw.duration) } : {}), ...(raw.aircraft?.name ? { aircraft: raw.aircraft.name } : {}) };
}
function normalizeJourney(raw: z.infer<typeof slice>): FlightJourney {
  const segments = raw.segments.map(normalizeSegment);
  return { segments, departure: segments[0]!.departure, arrival: segments.at(-1)!.arrival, ...(durationMinutes(raw.duration) !== undefined ? { durationMinutes: durationMinutes(raw.duration) } : {}), connectionCount: Math.max(segments.length - 1, 0) };
}

export function normalizeDuffelOffer(input: unknown, retrievedAt = new Date().toISOString()): FlightOffer {
  const raw = offer.parse(input);
  const amount = raw.total_amount === undefined ? undefined : Number(raw.total_amount);
  const totalPrice = amount !== undefined && Number.isFinite(amount) && amount >= 0 && raw.total_currency ? { amountMinor: Math.round(amount * 100), currency: raw.total_currency, scope: 'total_party' as const } : undefined;
  return flightOfferSchema.parse({ id: raw.id, provider: 'Duffel', environment: raw.live_mode ? 'live' : 'test', outbound: normalizeJourney(raw.slices[0]!), ...(raw.slices[1] ? { returnJourney: normalizeJourney(raw.slices[1]) } : {}), totalPrice, ...(raw.baggage_allowances ? { baggage: raw.baggage_allowances } : {}), ...(raw.expires_at ? { expiresAt: raw.expires_at } : {}), retrievedAt, sourceReference: raw.id });
}
