import type { Trip } from '../../trips/types/trip';
import { isItineraryStale } from '../../itinerary/domain/context';
import { generateItinerary } from '../../itinerary/domain/generator';
import { editItinerary } from '../../itinerary/domain/editing';
import { placeSchema, type Place } from '../domain/normalization';

export function placeAlreadyPlanned(trip: Trip, place: Place) {
  const planned = new Set(trip.itinerary?.days.flatMap((day) => day.items.map((item) => item.activityId)) ?? []);
  return trip.itinerary?.catalog.some((entry) => planned.has(entry.id) && (entry.id === place.id || (entry.place?.provider === place.place.provider && entry.providerId === place.providerId))) ?? false;
}
export function addDiscoveredPlace(trip: Trip, input: Place, dayId: string, now = new Date().toISOString()) {
  const place = placeSchema.parse(input);
  if (!trip.destinationResolution || trip.destinationResolution.providerId !== place.place.destinationId || trip.destinationResolution.provider !== place.place.provider) throw new Error('Resolve this trip destination again before adding a place from these results.');
  if (trip.itinerary && isItineraryStale(trip, trip.itinerary)) throw new Error('Your itinerary is outdated. Regenerate it before adding discovered places; your saved work is preserved.');
  if (placeAlreadyPlanned(trip, place)) throw new Error('This provider place is already planned. Repeated visits are not supported.');
  const itinerary = structuredClone(trip.itinerary ?? generateItinerary(trip, [], { generatedAt: now, dataMode: place.source === 'fixture' ? 'demo' : 'live', sourceLabel: place.source === 'fixture' ? 'Development fixture itinerary' : 'Geoapify / OpenStreetMap · manually selected places' }));
  const existing = itinerary.catalog.findIndex((entry) => entry.id === place.id);
  if (existing < 0) itinerary.catalog.push(place); else itinerary.catalog[existing] = place;
  if (place.source === 'fixture' || itinerary.catalog.some((entry) => entry.source === 'fixture')) {
    itinerary.metadata.dataMode = 'demo';
    if (itinerary.catalog.some((entry) => entry.source === 'provider')) itinerary.metadata.sourceLabel = 'Mixed itinerary — development fixtures and Geoapify places';
  }
  return editItinerary(itinerary, { type: 'add', activityId: place.id, dayId }, now);
}
