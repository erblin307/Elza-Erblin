import { z } from 'zod';
import type { Currency, Trip } from '../../trips/types/trip';
import { canonicalDestination } from '../../../shared/validation/location';

export const journeyModes = ['flight', 'train', 'bus', 'car', 'other'] as const;
export const journeyDirections = ['outbound', 'return'] as const;
const localDateTime = /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d$/u;
const utcOffset = /^(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/u;
const id = z.string().trim().min(1).max(600);
const text = z.string().trim().min(1).max(200);

export const travelEventSchema = z.object({
  location: text,
  localDateTime: z.string().regex(localDateTime, 'Use a valid local date and time.'),
  timeZone: z.string().trim().min(1).max(100).optional(),
  utcOffset: z.string().regex(utcOffset, 'Use a UTC offset such as +02:00.').optional(),
  instant: z.iso.datetime({ offset: true }).optional(),
  airport: z.object({ name: text, iataCode: z.string().regex(/^[A-Z]{3}$/u), providerId: id, latitude: z.number().finite().min(-90).max(90).optional(), longitude: z.number().finite().min(-180).max(180).optional() }).optional(),
}).refine((value) => !value.instant || Boolean(value.utcOffset || value.timeZone), { message: 'An absolute instant must retain its source timezone or offset.' });

export const journeyContextSchema = z.object({
  origin: text, destination: text, startDate: z.string().date(), endDate: z.string().date(), travelers: z.number().int().positive(),
});

export const journeyCostSchema = z.object({
  identity: id, amount: z.number().finite().nonnegative(), currency: z.string().regex(/^[A-Z]{3}$/u),
  provenance: z.enum(['provider_offer', 'user_estimate']), scope: z.enum(['journey', 'round_trip']),
  validUntil: z.iso.datetime({ offset: true }).optional(), reconciledExpenseId: id.optional(),
});

export const plannedJourneySchema = z.object({
  id, tripId: id, direction: z.enum(journeyDirections), mode: z.enum(journeyModes), source: z.enum(['provider', 'manual']), status: z.literal('planned'),
  departure: travelEventSchema, arrival: travelEventSchema.optional(), context: journeyContextSchema,
  operator: z.string().trim().max(160).optional(), serviceNumber: z.string().trim().max(80).optional(), bookingReference: z.string().trim().max(120).optional(), notes: z.string().trim().max(1000).optional(),
  provider: z.string().trim().max(100).optional(), providerEnvironment: z.enum(['test', 'live']).optional(), providerOfferId: id.optional(), offerGroupId: id.optional(),
  cost: journeyCostSchema.optional(), selectedAt: z.iso.datetime(), updatedAt: z.iso.datetime(),
}).superRefine((journey, ctx) => {
  if (journey.source === 'provider' && (!journey.provider || !journey.providerEnvironment || !journey.providerOfferId)) ctx.addIssue({ code: 'custom', message: 'Provider journeys require source and environment details.' });
  if (journey.source === 'manual' && journey.providerEnvironment) ctx.addIssue({ code: 'custom', message: 'Manual journeys cannot claim a provider environment.' });
  const departure = eventInstant(journey.departure); const arrival = journey.arrival ? eventInstant(journey.arrival) : undefined;
  if (departure !== undefined && arrival !== undefined && arrival <= departure) ctx.addIssue({ code: 'custom', path: ['arrival'], message: 'Arrival must be after departure.' });
});

export const longDistanceTravelPlanSchema = z.object({ version: z.literal(1), journeys: z.array(plannedJourneySchema).max(20) }).superRefine((plan, ctx) => {
  const ids = new Set<string>();
  for (const journey of plan.journeys) {
    if (ids.has(journey.id)) ctx.addIssue({ code: 'custom', message: 'Journey IDs must be unique.' });
    ids.add(journey.id);
  }
});

export type TravelEvent = z.infer<typeof travelEventSchema>;
export type JourneyCost = z.infer<typeof journeyCostSchema>;
export type PlannedJourney = z.infer<typeof plannedJourneySchema>;
export type LongDistanceTravelPlan = z.infer<typeof longDistanceTravelPlanSchema>;
export type JourneyMode = (typeof journeyModes)[number];
export type JourneyDirection = (typeof journeyDirections)[number];

export function emptyTravelPlan(): LongDistanceTravelPlan { return { version: 1, journeys: [] }; }

export function journeyContext(trip: Trip) {
  return { origin: trip.origin, destination: trip.destination, startDate: trip.startDate, endDate: trip.endDate, travelers: trip.travelers };
}

export function journeyNeedsReview(trip: Trip, journey: PlannedJourney) {
  const current = journeyContext(trip);
  return canonicalDestination(current.origin) !== canonicalDestination(journey.context.origin)
    || canonicalDestination(current.destination) !== canonicalDestination(journey.context.destination)
    || current.startDate !== journey.context.startDate || current.endDate !== journey.context.endDate || current.travelers !== journey.context.travelers;
}

export function eventInstant(event: TravelEvent) {
  if (event.instant) { const value = Date.parse(event.instant); return Number.isFinite(value) ? value : undefined; }
  if (!event.utcOffset) return undefined;
  const value = Date.parse(`${event.localDateTime}:00${event.utcOffset === 'Z' ? 'Z' : event.utcOffset}`);
  return Number.isFinite(value) ? value : undefined;
}

export function eventDate(event: TravelEvent) { return event.localDateTime.slice(0, 10); }
export function eventMinute(event: TravelEvent) { const [hours, minutes] = event.localDateTime.slice(11).split(':').map(Number); return hours! * 60 + minutes!; }
export function journeyExpired(journey: PlannedJourney, now = Date.now()) { return Boolean(journey.cost?.validUntil && Date.parse(journey.cost.validUntil) <= now); }

export type ManualJourneyInput = {
  direction: JourneyDirection; mode: JourneyMode; departureLocation: string; arrivalLocation: string;
  departureLocalDateTime: string; arrivalLocalDateTime?: string; departureUtcOffset?: string; arrivalUtcOffset?: string;
  operator?: string; serviceNumber?: string; bookingReference?: string; estimatedCost?: number; currency?: Currency; notes?: string;
};

function optionalText(value?: string) { const clean = value?.trim(); return clean ? clean : undefined; }

export function createManualJourney(trip: Trip, input: ManualJourneyInput, journeyId: string, now = new Date().toISOString()): PlannedJourney {
  const departure: TravelEvent = { location: input.departureLocation, localDateTime: input.departureLocalDateTime, ...(optionalText(input.departureUtcOffset) ? { utcOffset: optionalText(input.departureUtcOffset) } : {}) };
  const arrival: TravelEvent | undefined = input.arrivalLocalDateTime ? { location: input.arrivalLocation, localDateTime: input.arrivalLocalDateTime, ...(optionalText(input.arrivalUtcOffset) ? { utcOffset: optionalText(input.arrivalUtcOffset) } : {}) } : undefined;
  const cost = input.estimatedCost === undefined ? undefined : { identity: `manual-journey-cost-${journeyId}`, amount: input.estimatedCost, currency: input.currency ?? trip.budget.currency, provenance: 'user_estimate' as const, scope: 'journey' as const };
  return plannedJourneySchema.parse({ id: journeyId, tripId: trip.id, direction: input.direction, mode: input.mode, source: 'manual', status: 'planned', departure, arrival, context: journeyContext(trip), operator: optionalText(input.operator), serviceNumber: optionalText(input.serviceNumber), bookingReference: optionalText(input.bookingReference), notes: optionalText(input.notes), cost, selectedAt: now, updatedAt: now });
}

export function updateManualJourney(trip: Trip, existing: PlannedJourney, input: ManualJourneyInput, now = new Date().toISOString()) {
  if (existing.source !== 'manual') throw new Error('Provider journeys must be replaced from a current offer.');
  return { ...createManualJourney(trip, input, existing.id, existing.selectedAt), selectedAt: existing.selectedAt, updatedAt: now };
}
