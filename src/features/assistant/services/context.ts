import type { Trip } from '../../trips/types/trip';
import { calculateBudget, formatMoney } from '../../budget/domain/engine';
import { activityCost } from '../../itinerary/domain/costs';
import { isItineraryStale } from '../../itinerary/domain/context';
import { stayNeedsReview } from '../../accommodation/domain/accommodation';
import { journeyExpired, journeyNeedsReview } from '../../long-distance-transport/domain/model';
import { scheduleIssues } from '../../long-distance-transport/domain/schedule';
import { planSegments } from '../../transport/domain/planner';
import type { Topic } from '../domain/contracts';

export const clockLabel = (minute: number) => `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
export function daySummary(trip: Trip, index: number) {
  const day = trip.itinerary?.days[index];
  if (!day) throw new Error('That itinerary day does not exist. Check the saved itinerary day numbers.');
  return { id: day.id, number: index + 1, date: day.date, activities: day.items.map((item) => {
    const candidate = trip.itinerary!.catalog.find((entry) => entry.id === item.activityId);
    return { itemId: item.id, name: candidate?.name ?? 'Activity reference unavailable', time: `${clockLabel(item.startMinute)}–${clockLabel(item.endMinute)}`, durationMinutes: item.endMinute - item.startMinute, durationAssumed: item.durationAssumed, source: candidate?.sourceName ?? 'Unknown', knownCost: candidate ? activityCost(candidate, { travelers: trip.travelers, currency: trip.budget.currency }).amount : undefined };
  }) };
}

// Explicit projections: never serialize notes, booking references, raw provider records or another Trip.
export function buildAssistantContext(trip: Trip, topic: Topic, day?: number) {
  if (day !== undefined && (!Number.isInteger(day) || day < 1 || !trip.itinerary?.days[day - 1])) throw new Error('That itinerary day does not exist.');
  const scope = { tripId: trip.id, revision: trip.updatedAt, topic };
  if (topic === 'budget') {
    const b = calculateBudget(trip);
    return { ...scope, budget: { limit: trip.budget.amount, currency: trip.budget.currency, known: b.total, confirmed: b.confirmedTotal, estimated: b.estimatedTotal, remaining: b.remaining, overBy: b.overBy, unknownCount: b.unknownSourceCount, coverage: b.coverage } };
  }
  if (topic === 'itinerary' || topic === 'unknown_costs') return { ...scope, itinerary: trip.itinerary ? { stale: isItineraryStale(trip, trip.itinerary), source: trip.itinerary.metadata.sourceLabel, days: day ? [daySummary(trip, day - 1)] : trip.itinerary.days.map((_, index) => daySummary(trip, index)) } : null };
  if (topic === 'accommodation') { const s = trip.selectedStay; return { ...scope, accommodation: s ? { name: s.property.name, address: s.property.place.address, checkIn: s.checkIn, checkOut: s.checkOut, status: s.selectionStatus, needsReview: stayNeedsReview(trip) } : null }; }
  if (topic === 'journeys') return { ...scope, journeys: (trip.longDistanceTravel?.journeys ?? []).map((j) => ({ direction: j.direction, mode: j.mode, departure: j.departure, arrival: j.arrival, source: j.source, environment: j.providerEnvironment, status: j.status, expired: journeyExpired(j), needsReview: journeyNeedsReview(trip, j) })) };
  if (topic === 'transport') return { ...scope, segments: planSegments(trip).filter((s) => !day || s.dayId === trip.itinerary?.days[day - 1]?.id).map((s) => ({ id: s.id, from: s.from.name, to: s.to.name, mode: s.mode, unavailable: s.unavailable, duration: 'Requires current provider calculation' })) };
  if (topic === 'conflicts') return { ...scope, warnings: [...scheduleIssues(trip).map((i) => i.message), ...(trip.itinerary && isItineraryStale(trip, trip.itinerary) ? ['Saved itinerary is outdated. Review it before changes.'] : [])], uncertainty: 'Local route timing and airport/station transfers may be incomplete.' };
  return { ...scope, trip: { title: trip.title, origin: trip.origin, destination: trip.destination, startDate: trip.startDate, endDate: trip.endDate, travelers: trip.travelers, pace: trip.preferences?.pace ?? 'balanced', budget: trip.budget, itineraryDays: trip.itinerary?.days.length ?? 0, accommodation: trip.selectedStay?.property.name ?? null } };
}

export function answerQuestion(trip: Trip, topic: Topic, day?: number): string {
  if (day && !trip.itinerary?.days[day - 1]) throw new Error('That itinerary day does not exist.');
  if (topic === 'help') return 'Try: Summarize my trip; Review my budget; What is planned for Day 2?; Which hotel did I choose?; When do I arrive?; Identify schedule conflicts; List unknown costs; Make Day 2 more relaxed; Make Day 2 cheaper; Find alternative places; Reduce walking on Day 2.\nCommands: move "exact activity name" to day 2; remove "exact activity name"; reorder "exact activity name" up/down; set pace relaxed/balanced/active. Every change needs a preview and Apply.';
  const c = buildAssistantContext(trip, topic, day);
  if ('budget' in c) { const b = c.budget; const money = (v: number) => formatMoney(v, trip.budget.currency); return `Trip budget: ${money(b.limit)}\nKnown cost forecast: ${money(b.known)}\nRecorded confirmed spending: ${money(b.confirmed)}\nEstimated costs: ${money(b.estimated)}\n${b.overBy ? `Over budget by ${money(b.overBy)}` : `Remaining after known costs: ${money(b.remaining)}`}\n${b.unknownCount ? `${b.unknownCount} costs are unknown or non-comparable. This is an incomplete forecast.` : 'Only currently recorded comparable costs are included.'}`; }
  if ('itinerary' in c) {
    if (!c.itinerary) return 'No itinerary has been generated for this Trip.';
    return `${c.itinerary.stale ? 'Saved itinerary needs review.\n' : ''}Source: ${c.itinerary.source}. Times are proposed.\n` + c.itinerary.days.map((d) => `Day ${d.number} · ${d.date}\n${d.activities.filter((a) => topic !== 'unknown_costs' || a.knownCost === undefined).map((a) => `${a.time} · ${a.name} · ${a.durationMinutes} min${a.durationAssumed ? ' (planning assumption)' : ''}${topic === 'unknown_costs' ? ' · price unknown/non-comparable' : ''}`).join('\n') || (topic === 'unknown_costs' ? 'No unknown activity costs in this day.' : 'No activities planned.')}`).join('\n\n');
  }
  if ('accommodation' in c) { const s = c.accommodation; return s ? `${s.name}\n${s.address ?? 'Address unavailable'}\n${s.checkIn} → ${s.checkOut}\nPlanned stay; booking and price are unverified.${s.needsReview ? '\nSelection needs review for current Trip details.' : ''}` : 'No accommodation is selected for this Trip.'; }
  if ('journeys' in c) return c.journeys.length ? c.journeys.map((j) => `${j.direction} · ${j.mode} · ${j.source === 'manual' ? 'User-entered schedule' : `${j.environment ?? 'unknown'} provider data`}\n${j.departure.location} · ${j.departure.localDateTime} ${j.departure.timeZone ?? j.departure.utcOffset ?? '(timezone unknown)'}\n${j.arrival ? `Arrival: ${j.arrival.location} · ${j.arrival.localDateTime} ${j.arrival.timeZone ?? j.arrival.utcOffset ?? '(timezone unknown)'}` : 'Arrival time unknown'}\nPlanned journey.${j.expired ? ' Offer expired.' : ''}${j.needsReview ? ' Needs review.' : ''}`).join('\n\n') : 'No long-distance journey is planned. Arrival time is unknown.';
  if ('segments' in c) return c.segments.length ? c.segments.map((s) => `${s.from} → ${s.to} · ${s.mode}\n${s.unavailable ?? s.duration}`).join('\n\n') + '\nFares, traffic and accessibility are unverified. Open Transport for current route calculations.' : 'No local connections are planned. Add itinerary activities first.';
  if ('warnings' in c) return `${c.warnings.join('\n') || 'No obvious long-distance schedule conflict was found in saved data.'}\n${c.uncertainty}`;
  return `${trip.title}: ${trip.origin} → ${trip.destination}\n${trip.startDate} → ${trip.endDate} · ${trip.travelers} travelers\n${trip.itinerary ? `${trip.itinerary.days.length} itinerary days saved` : 'No itinerary generated'}\nStay: ${trip.selectedStay?.property.name ?? 'Not selected'}\nTotal budget: ${formatMoney(trip.budget.amount, trip.budget.currency)}\nTravel pace: ${trip.preferences?.pace ?? 'balanced'}`;
}
