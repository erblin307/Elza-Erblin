import { z } from 'zod';
import { geoEntitySchema, geoFields, normalizeGeoEntity } from '../../places/domain/geoEntity';
import { propertyTypes, propertyTypesFor } from './categories';
import { isRealDateOnly } from '../../trips/validation/tripSchema';
import { isValidTripId } from '../../trips/validation/tripId';
import { canonicalDestination } from '../../../shared/validation/location';
import { distanceMeters } from '../../../shared/validation/geography';
import type { Trip } from '../../trips/types/trip';

export const accommodationSchema = geoEntitySchema.safeExtend({ types: z.array(z.enum(propertyTypes)).min(1) })
  .refine((property) => JSON.stringify([...property.types].sort()) === JSON.stringify(propertyTypesFor(property.place.providerCategories).sort()), { message: 'Property type must match source categories.' });
export type Accommodation = z.infer<typeof accommodationSchema>;
const date = z.string().refine(isRealDateOnly, 'Invalid stay date.');
export const selectedStaySchema = z.object({
  tripId: z.string().refine(isValidTripId), property: accommodationSchema,
  destinationLabel: z.string().trim().min(1).max(500), checkIn: date, checkOut: date,
  travelers: z.number().int().positive(), selectionStatus: z.literal('planned'), selectedAt: z.iso.datetime(),
}).refine((stay) => stay.checkOut > stay.checkIn, { message: 'A planned overnight stay requires at least one night.' });
export type SelectedStay = z.infer<typeof selectedStaySchema>;
export function stayNeedsReview(trip: Trip, stay = trip.selectedStay): boolean {
  return !!stay && (stay.tripId !== trip.id || canonicalDestination(stay.destinationLabel) !== canonicalDestination(trip.destination)
    || trip.destinationResolution?.provider !== 'geoapify' || stay.property.place.destinationId !== trip.destinationResolution.providerId
    || stay.checkIn !== trip.startDate || stay.checkOut !== trip.endDate || stay.travelers !== trip.travelers);
}
export function createSelectedStay(trip: Trip, property: Accommodation, now = new Date().toISOString()): SelectedStay {
  const stay = selectedStaySchema.parse({ tripId: trip.id, property, destinationLabel: trip.destination, checkIn: trip.startDate, checkOut: trip.endDate, travelers: trip.travelers, selectionStatus: 'planned', selectedAt: now });
  if (stayNeedsReview(trip, stay)) throw new Error('Confirm the current trip destination before selecting this property.');
  return stay;
}
export function normalizeAccommodations(raw: unknown, destinationId: string, now: string) {
  const envelope = z.object({ features: z.array(z.unknown()) }).safeParse(raw);
  if (!envelope.success) throw new Error('The accommodation provider returned an invalid response.');
  const properties = new Map<string, Accommodation>(); const conflicts = new Set<string>(); let rejectedCount = 0;
  for (const feature of envelope.data.features) {
    const p = z.object({ properties: geoFields }).safeParse(feature);
    const entity = p.success ? normalizeGeoEntity(p.data.properties, destinationId, now) : null;
    const parsed = entity?.success ? accommodationSchema.safeParse({ ...entity.data, types: propertyTypesFor(entity.data.place.providerCategories) }) : null;
    if (!parsed?.success || conflicts.has(parsed.data.id)) { rejectedCount++; continue; }
    const property = parsed.data; const prior = properties.get(property.id);
    if (prior) {
      if (distanceMeters(prior.location, property.location) > 0.01) { properties.delete(property.id); conflicts.add(property.id); rejectedCount += 2; continue; }
      property.place.providerCategories = [...new Set([...prior.place.providerCategories, ...property.place.providerCategories])];
      property.types = propertyTypesFor(property.place.providerCategories);
      property.place.references = { ...property.place.references, ...Object.fromEntries(Object.entries(prior.place.references).filter(([, value]) => value !== undefined)) };
    }
    properties.set(property.id, property);
  }
  return { properties: [...properties.values()], rejectedCount };
}
