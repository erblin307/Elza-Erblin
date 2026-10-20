import { z } from 'zod';
import { accommodationOptions, interestOptions, paceOptions, supportedCurrencies, transportationOptions } from '../../trips/types/trip';
import { isRealDateOnly } from '../../trips/validation/tripSchema';
import { isValidTripId } from '../../trips/validation/tripId';
import { costSummary } from './costs';
import { calendarDates, dayLimits, lunch } from './scheduling';
import { geoLocationSchema } from '../../../shared/validation/location';
import { placeMetadataSchema } from '../../places/domain/placeMetadata';

const identifier = z.string().refine(isValidTripId, 'Invalid identifier.');
const entityIdentifier = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,599}$/u);
const dateOnly = z.string().refine(isRealDateOnly, 'Invalid calendar date.');
const minute = z.number().int().min(0).max(1440);
const text = z.string().trim().min(1).max(500);

export const activityCandidateSchema = z.object({
  id: entityIdentifier, name: text, description: z.string().max(2000).optional(),
  destination: text,
  categories: z.array(z.enum(interestOptions)).min(1).transform((values) => [...new Set(values)].sort()),
  location: geoLocationSchema.optional(),
  durationMinutes: z.number().int().positive().max(1440).optional(),
  price: z.object({ amount: z.number().finite().nonnegative(), currency: z.enum(supportedCurrencies), unit: z.enum(['person', 'group', 'entry']), entriesRequired: z.number().int().positive().optional(), basis: z.enum(['sample_estimate', 'source_estimate']) }).optional(),
  rating: z.number().finite().min(0).max(5).optional(),
  openingWindows: z.array(z.object({ date: dateOnly, startMinute: minute, endMinute: minute }).refine((window) => window.endMinute > window.startMinute)).optional(),
  source: z.enum(['provider', 'curated', 'fixture']), sourceName: text, providerId: entityIdentifier.optional(), place: placeMetadataSchema.optional(),
}).refine((candidate) => candidate.source !== 'fixture' || candidate.price === undefined || candidate.price.basis === 'sample_estimate', { message: 'Fixture costs must be labeled sample estimates.' })
  .refine((candidate) => !candidate.place || (candidate.place.provider === 'fixture' ? candidate.source === 'fixture' : candidate.source === 'provider'), { message: 'Place source disclosure mismatch.' })
  .refine((candidate) => !candidate.place?.image || candidate.place.image.entityId === candidate.place.references.wikidataId, { message: 'Photo identity mismatch.' });

export const planningContextSchema = z.object({
  destination: text, startDate: dateOnly, endDate: dateOnly, travelers: z.number().int().positive(),
  totalBudget: z.number().finite().positive(), currency: z.enum(supportedCurrencies),
  pace: z.enum(paceOptions), interests: z.array(z.enum(interestOptions)),
  transportation: z.array(z.enum(transportationOptions)), accommodation: z.enum(accommodationOptions),
  destinationId: z.string().min(1).max(512).optional(),
  arrivalConstraint: z.object({ date: dateOnly, minute }).optional(),
  departureConstraint: z.object({ date: dateOnly, minute }).optional(),
});
export const planningConfigSchema = z.object({
  activityAllowance: z.number().finite().nonnegative(),
  unknownDurationMinutes: z.number().int().positive().max(240), bufferMinutes: z.number().int().min(15).max(120),
  weights: z.object({ interest: z.number().finite().nonnegative().max(1000), diversity: z.number().finite().nonnegative().max(1000), budget: z.number().finite().nonnegative().max(1000), duration: z.number().finite().nonnegative().max(1000), quality: z.number().finite().nonnegative().max(1000) }),
});

export const itineraryShape = z.object({
  version: z.literal(1), tripId: identifier, tripFingerprint: z.string().min(1),
  context: planningContextSchema, config: planningConfigSchema,
  catalog: z.array(activityCandidateSchema),
  days: z.array(z.object({
    id: identifier, date: dateOnly, provisional: z.boolean(),
    items: z.array(z.object({ id: identifier, activityId: entityIdentifier, dayId: identifier, order: z.number().int().nonnegative(), startMinute: minute, endMinute: minute, durationAssumed: z.boolean(), manuallyAdded: z.boolean(), reasons: z.array(z.string().max(500)) })),
    breaks: z.array(z.object({ startMinute: minute, endMinute: minute, label: text })),
  })).min(1).max(366),
  metadata: z.object({ generatedAt: z.iso.datetime(), updatedAt: z.iso.datetime(), strategy: z.literal('deterministic-greedy-v1'), dataMode: z.enum(['live', 'demo']), sourceLabel: text, manuallyAdjusted: z.boolean(), warnings: z.array(z.string().max(500)) }),
});

export const itinerarySchema = itineraryShape.superRefine((itinerary, ctx) => {
  const issue = (message: string) => ctx.addIssue({ code: 'custom', message });
  let dates: string[];
  try { dates = calendarDates(itinerary.context.startDate, itinerary.context.endDate); }
  catch { issue('Invalid itinerary date range.'); return; }
  if (JSON.stringify(itinerary.context) !== itinerary.tripFingerprint) issue('Itinerary context fingerprint mismatch.');
  if (itinerary.config.activityAllowance > itinerary.context.totalBudget) issue('Activity allowance exceeds the total trip budget.');
  const catalog = new Map(itinerary.catalog.map((candidate) => [candidate.id, candidate]));
  if (catalog.size !== itinerary.catalog.length) issue('Duplicate candidate IDs.');
  if (itinerary.catalog.some((candidate) => candidate.destination.normalize('NFC').trim().replace(/\s+/gu, ' ').toLowerCase() !== itinerary.context.destination)) issue('Candidate destination mismatch.');
  if (itinerary.catalog.some((candidate) => candidate.place && candidate.place.destinationId !== itinerary.context.destinationId)) issue('Resolved place destination mismatch.');
  if (itinerary.metadata.dataMode === 'live' && itinerary.catalog.some((candidate) => candidate.source === 'fixture')) issue('Fixture data must be disclosed as demonstration data.');
  if (dates.length !== itinerary.days.length) issue('Itinerary must include every trip calendar day.');
  const seenDays = new Set<string>(); const seenItems = new Set<string>(); const seenActivities = new Set<string>();
  for (const [dayIndex, day] of itinerary.days.entries()) {
    if (day.date !== dates[dayIndex] || seenDays.has(day.id)) issue('Invalid itinerary day sequence.');
    seenDays.add(day.id);
    const limits = dayLimits(day.date, itinerary.context);
    if (day.provisional !== limits.provisional || day.items.length > limits.maxActivities) issue('Invalid daily planning capacity.');
    let duration = 0; let previousEnd = limits.startMinute - itinerary.config.bufferMinutes;
    for (const [index, item] of day.items.entries()) {
      const candidate = catalog.get(item.activityId);
      if (!candidate || item.dayId !== day.id || item.order !== index || seenItems.has(item.id) || seenActivities.has(item.activityId)) { issue('Invalid or duplicated activity occurrence.'); continue; }
      seenItems.add(item.id); seenActivities.add(item.activityId);
      const expectedDuration = candidate.durationMinutes ?? itinerary.config.unknownDurationMinutes;
      if (item.endMinute - item.startMinute !== expectedDuration || item.durationAssumed !== (candidate.durationMinutes === undefined)) issue('Invalid activity duration.');
      if (item.startMinute < previousEnd + itinerary.config.bufferMinutes || item.endMinute > limits.endMinute || item.startMinute < limits.startMinute || (item.startMinute < lunch.endMinute && item.endMinute > lunch.startMinute)) issue('Activity schedule overlaps or exceeds its proposed window.');
      if (candidate.openingWindows && !candidate.openingWindows.some((window) => window.date === day.date && item.startMinute >= window.startMinute && item.endMinute <= window.endMinute)) issue('Activity violates available opening windows.');
      previousEnd = item.endMinute; duration += expectedDuration;
    }
    if (duration > limits.activityMinutes) issue('Daily activity duration exceeded.');
    for (const block of day.breaks) if (block.endMinute <= block.startMinute || day.items.some((item) => block.startMinute < item.endMinute && block.endMinute > item.startMinute)) issue('Invalid planning break.');
  }
  const costs = costSummary(itinerary.days.flatMap((day) => day.items), itinerary.catalog, itinerary.context);
  if (costs.knownCost > itinerary.config.activityAllowance + 0.005) issue('Known activity costs exceed the configured allowance.');
});

export function validateCandidates(raw: unknown[]) {
  const parsed = raw.map((entry) => activityCandidateSchema.safeParse(entry));
  const counts = new Map<string, number>();
  for (const entry of parsed) if (entry.success) counts.set(entry.data.id, (counts.get(entry.data.id) ?? 0) + 1);
  const candidates = parsed.flatMap((entry) => entry.success && counts.get(entry.data.id) === 1 ? [entry.data] : []);
  return { candidates, rejectedCount: raw.length - candidates.length };
}
