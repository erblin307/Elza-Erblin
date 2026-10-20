import type { Trip } from '../../trips/types/trip';
import type { ItineraryDay } from '../../itinerary/types/itinerary';
import { eventDate, eventMinute, journeyNeedsReview } from './model';

export type TravelConstraint = { date: string; minute: number; source: 'arrival' | 'departure'; journeyId: string; transferUnknown: boolean };
export type JourneyScheduleIssue = { kind: 'conflict' | 'uncertain' | 'outside-trip' | 'overlap'; message: string; journeyId?: string; dayId?: string };

export function travelConstraints(trip: Trip): { arrival?: TravelConstraint; departure?: TravelConstraint } {
  const journeys = (trip.longDistanceTravel?.journeys ?? []).filter((journey) => !journeyNeedsReview(trip, journey));
  const outbound = journeys.filter((journey) => journey.direction === 'outbound' && journey.arrival).sort((a, b) => a.arrival!.localDateTime.localeCompare(b.arrival!.localDateTime)).at(-1);
  const returning = journeys.filter((journey) => journey.direction === 'return').sort((a, b) => a.departure.localDateTime.localeCompare(b.departure.localDateTime))[0];
  return {
    ...(outbound?.arrival ? { arrival: { date: eventDate(outbound.arrival), minute: eventMinute(outbound.arrival), source: 'arrival' as const, journeyId: outbound.id, transferUnknown: true } } : {}),
    ...(returning ? { departure: { date: eventDate(returning.departure), minute: eventMinute(returning.departure), source: 'departure' as const, journeyId: returning.id, transferUnknown: true } } : {}),
  };
}

export function scheduleIssues(trip: Trip, days: ItineraryDay[] = trip.itinerary?.days ?? []): JourneyScheduleIssue[] {
  const issues: JourneyScheduleIssue[] = [];
  const current = (trip.longDistanceTravel?.journeys ?? []).filter((journey) => !journeyNeedsReview(trip, journey));
  for (const journey of trip.longDistanceTravel?.journeys ?? []) if (journeyNeedsReview(trip, journey)) issues.push({ kind: 'uncertain', journeyId: journey.id, message: 'A preserved journey needs review because the Trip route, dates or traveler count changed.' });
  for (const journey of current) {
    const date = journey.direction === 'outbound' && journey.arrival ? eventDate(journey.arrival) : eventDate(journey.departure);
    if (date < trip.startDate || date > trip.endDate) issues.push({ kind: 'outside-trip', journeyId: journey.id, message: `A ${journey.direction} journey event falls outside the current Trip dates.` });
  }
  const constraints = travelConstraints(trip);
  if (constraints.arrival) {
    const day = days.find((entry) => entry.date === constraints.arrival!.date);
    for (const item of day?.items ?? []) if (item.startMinute < constraints.arrival.minute) issues.push({ kind: 'conflict', dayId: day!.id, journeyId: constraints.arrival.journeyId, message: 'An activity starts before the planned destination arrival.' });
    issues.push({ kind: 'uncertain', journeyId: constraints.arrival.journeyId, message: 'Arrival-to-accommodation transfer time is not included.' });
  }
  if (constraints.departure) {
    const day = days.find((entry) => entry.date === constraints.departure!.date);
    for (const item of day?.items ?? []) if (item.endMinute > constraints.departure.minute) issues.push({ kind: 'conflict', dayId: day!.id, journeyId: constraints.departure.journeyId, message: 'An activity extends beyond the planned return departure.' });
    issues.push({ kind: 'uncertain', journeyId: constraints.departure.journeyId, message: 'Accommodation-to-departure transfer time is not included.' });
  }
  const outboundArrival = current.filter((journey) => journey.direction === 'outbound').flatMap((journey) => journey.arrival ? [journey.arrival.localDateTime] : []).sort().at(-1);
  const returnDeparture = current.filter((journey) => journey.direction === 'return').map((journey) => journey.departure.localDateTime).sort()[0];
  if (outboundArrival && returnDeparture && returnDeparture <= outboundArrival) issues.push({ kind: 'overlap', message: 'Outbound arrival and return departure overlap or occur in an impossible order.' });
  return issues.filter((issue, index, all) => all.findIndex((candidate) => candidate.kind === issue.kind && candidate.message === issue.message && candidate.dayId === issue.dayId) === index);
}
