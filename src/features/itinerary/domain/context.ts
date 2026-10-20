import { defaultPreferences, type Trip } from '../../trips/types/trip';
import type { GeneratedItinerary, PlanningContext, ScoreWeights } from '../types/itinerary';
import { travelConstraints } from '../../long-distance-transport/domain/schedule';

export const defaultWeights: ScoreWeights = { interest: 60, diversity: 16, budget: 10, duration: 6, quality: 5 };

export function planningContext(trip: Trip): PlanningContext {
  const preferences = trip.preferences ?? defaultPreferences();
  const constraints = travelConstraints(trip);
  return {
    destination: trip.destination.normalize('NFC').trim().replace(/\s+/gu, ' ').toLowerCase(),
    startDate: trip.startDate, endDate: trip.endDate, travelers: trip.travelers,
    totalBudget: trip.budget.amount, currency: trip.budget.currency,
    pace: preferences.pace, interests: [...preferences.interests].sort(),
    transportation: [...preferences.transportation].sort(), accommodation: preferences.accommodation,
    ...(trip.destinationResolution ? { destinationId: trip.destinationResolution.providerId } : {}),
    ...(constraints.arrival ? { arrivalConstraint: { date: constraints.arrival.date, minute: constraints.arrival.minute } } : {}),
    ...(constraints.departure ? { departureConstraint: { date: constraints.departure.date, minute: constraints.departure.minute } } : {}),
  };
}

export function tripFingerprint(trip: Trip) { return JSON.stringify(planningContext(trip)); }
export function isItineraryStale(trip: Trip, itinerary: GeneratedItinerary) { return tripFingerprint(trip) !== itinerary.tripFingerprint; }
