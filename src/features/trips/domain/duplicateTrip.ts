import type { GeneratedItinerary } from '../../itinerary/types/itinerary';
import { isItineraryStale } from '../../itinerary/domain/context';
import { stayNeedsReview } from '../../accommodation/domain/accommodation';
import type { Trip } from '../types/trip';

type IdFactory = (kind: 'day' | 'item' | 'expense' | 'journey') => string;

function defaultId(kind: 'day' | 'item' | 'expense' | 'journey') {
  return `${kind}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
}

export function copyTitle(title: string, existingTitles: Iterable<string>) {
  const used = new Set([...existingTitles].map((value) => value.toLocaleLowerCase()));
  let candidate = `${title} (Copy)`;
  let number = 2;
  while (used.has(candidate.toLocaleLowerCase())) candidate = `${title} (Copy ${number++})`;
  return candidate;
}

function duplicateItinerary(itinerary: GeneratedItinerary, tripId: string, now: string, nextId: IdFactory): GeneratedItinerary {
  const days = itinerary.days.map((day) => {
    const dayId = nextId('day');
    return { ...day, id: dayId, items: day.items.map((item, order) => ({ ...item, id: nextId('item'), dayId, order })) };
  });
  return { ...itinerary, tripId, catalog: itinerary.catalog.map((candidate) => structuredClone(candidate)), days, metadata: { ...itinerary.metadata, updatedAt: now } };
}

export function duplicateTrip(source: Trip, id: string, title: string, now: string, nextId: IdFactory = defaultId): Trip {
  const copy: Trip = {
    id, title, origin: source.origin, destination: source.destination,
    startDate: source.startDate, endDate: source.endDate, travelers: source.travelers,
    budget: { ...source.budget },
    createdAt: now, updatedAt: now,
    ...(source.preferences ? { preferences: { ...source.preferences, transportation: [...source.preferences.transportation], interests: [...source.preferences.interests] } } : {}),
    ...(source.destinationResolution ? { destinationResolution: structuredClone(source.destinationResolution) } : {}),
  };
  if (source.itinerary && !isItineraryStale(source, source.itinerary)) copy.itinerary = duplicateItinerary(source.itinerary, id, now, nextId);
  if (source.selectedStay && !stayNeedsReview(source, source.selectedStay)) copy.selectedStay = { ...structuredClone(source.selectedStay), tripId: id, selectedAt: now };
  if (source.transportSettings) copy.transportSettings = { ...source.transportSettings, segmentModes: {} };
  const planningExpenses = source.budgetLedger?.expenses.filter((expense) => expense.certainty === 'estimated').map((expense) => ({ ...expense, id: nextId('expense'), tripId: id, createdAt: now, updatedAt: now }));
  if (planningExpenses?.length) copy.budgetLedger = { version: 1, expenses: planningExpenses };
  const journeys = source.longDistanceTravel?.journeys.filter((journey) => !journey.cost?.validUntil || Date.parse(journey.cost.validUntil) > Date.parse(now)).map((journey) => ({
    ...structuredClone(journey), id: nextId('journey'), tripId: id,
    context: { origin: copy.origin, destination: copy.destination, startDate: copy.startDate, endDate: copy.endDate, travelers: copy.travelers },
    ...(journey.cost ? { cost: { ...journey.cost, identity: `copy-${id}-${journey.cost.identity}` } } : {}), selectedAt: now, updatedAt: now,
  }));
  if (journeys?.length) copy.longDistanceTravel = { version: 1, journeys };
  return copy;
}
