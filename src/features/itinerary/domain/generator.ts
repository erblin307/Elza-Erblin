import type { Trip } from '../../trips/types/trip';
import { storedTripSchema } from '../../trips/validation/tripSchema';
import { defaultWeights, planningContext, tripFingerprint } from './context';
import { activityCost, costSummary } from './costs';
import { rankCandidates } from './scoring';
import { buildDaySchedule, calendarDates } from './scheduling';
import { itinerarySchema, planningConfigSchema, validateCandidates } from './validation';
import type { GeneratedItinerary, ItineraryItem, PlanningConfig } from '../types/itinerary';

export type GenerationOptions = {
  activityAllowance?: number;
  weights?: Partial<PlanningConfig['weights']>;
  generatedAt: string;
  dataMode: 'live' | 'demo';
  sourceLabel: string;
};

export function generateItinerary(trip: Trip, rawCandidates: unknown[], options: GenerationOptions): GeneratedItinerary {
  storedTripSchema.parse(trip);
  const context = planningContext(trip);
  const config = planningConfigSchema.parse({ activityAllowance: options.activityAllowance ?? Math.floor(context.totalBudget * 20) / 100, unknownDurationMinutes: 60, bufferMinutes: 30, weights: { ...defaultWeights, ...options.weights } });
  if (config.activityAllowance > context.totalBudget) throw new Error('The activity allowance cannot exceed the total trip budget.');
  const validated = validateCandidates(rawCandidates);
  const catalog = validated.candidates.filter((candidate) => candidate.destination.normalize('NFC').trim().replace(/\s+/gu, ' ').toLowerCase() === context.destination && (options.dataMode === 'demo' || candidate.source !== 'fixture'))
    .sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const eligible = catalog.filter((candidate) => !context.interests.length || candidate.categories.some((category) => context.interests.includes(category)));
  let days = calendarDates(context.startDate, context.endDate).map((date) => ({ id: `day-${date}`, date, provisional: false, items: [] as ItineraryItem[], breaks: [] as GeneratedItinerary['days'][number]['breaks'] }));
  const remaining = new Set(eligible.map((candidate) => candidate.id));
  const coveredCategories = new Set<string>();
  let knownCost = 0;
  // Round-robin distribution gives every day an opportunity before adding further activities.
  for (let round = 0; round < 6; round++) {
    for (const [dayIndex, day] of days.entries()) {
      const ranked = rankCandidates(eligible.filter((candidate) => remaining.has(candidate.id)), context, config, coveredCategories);
      for (const rankedCandidate of ranked) {
        const candidate = rankedCandidate.candidate;
        const cost = activityCost(candidate, context);
        if (cost.amount !== undefined && knownCost + cost.amount > config.activityAllowance + 0.005) continue;
        const item: ItineraryItem = { id: `item-${catalog.findIndex((entry) => entry.id === candidate.id)}`, activityId: candidate.id, dayId: day.id, order: day.items.length, startMinute: 0, endMinute: 0, durationAssumed: false, manuallyAdded: false, reasons: rankedCandidate.reasons };
        try {
          const scheduled = buildDaySchedule({ ...day, items: [...day.items, item] }, catalog, context, config);
          days[dayIndex] = scheduled;
          remaining.delete(candidate.id);
          candidate.categories.forEach((category) => coveredCategories.add(category));
          knownCost += cost.amount ?? 0;
          break;
        } catch { /* A feasible candidate may fit another day; never force it into this one. */ }
      }
    }
  }
  days = days.map((day) => buildDaySchedule(day, catalog, context, config));
  const costs = costSummary(days.flatMap((day) => day.items), catalog, context);
  const warnings = ['All times are proposed planning times. Routing and travel durations are not verified.'];
  if (context.arrivalConstraint || context.departureConstraint) warnings.push('Selected long-distance travel times constrain boundary-day activity windows. Airport, station or hotel transfer time remains unknown.');
  else warnings.push('First and last days are provisional because arrival and departure times are unknown.');
  if (validated.rejectedCount) warnings.push(`${validated.rejectedCount} invalid or conflicting candidate records were excluded.`);
  if (days.some((day) => day.items.length < 2)) warnings.push('Available suitable data is limited; some days have few or no activities.');
  if (costs.unknownCount) warnings.push('Known activity costs are an incomplete estimate; unknown or non-comparable prices are not treated as free.');
  const now = options.generatedAt;
  return itinerarySchema.parse({ version: 1, tripId: trip.id, tripFingerprint: tripFingerprint(trip), context, config, catalog, days, metadata: { generatedAt: now, updatedAt: now, strategy: 'deterministic-greedy-v1', dataMode: options.dataMode, sourceLabel: options.sourceLabel, manuallyAdjusted: false, warnings } });
}
