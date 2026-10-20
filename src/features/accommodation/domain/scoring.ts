import type { Trip } from '../../trips/types/trip';
import type { Accommodation } from './accommodation';
import { distanceMeters, type GeoPoint } from '../../../shared/validation/geography';
import { propertyTypeLabel } from './categories';

export const accommodationWeights = { preferredType: 100, proximity: 20 } as const;
export function scoreAccommodation(property: Accommodation, trip: Trip, center: GeoPoint, radiusKm: number) {
  const distanceKm = distanceMeters(center, property.location) / 1000;
  const preference = trip.preferences?.accommodation;
  const match = !!preference && preference !== 'any' && property.types.includes(preference);
  const factors = { preferredType: match ? accommodationWeights.preferredType : 0, proximity: accommodationWeights.proximity * Math.max(0, 1 - distanceKm / radiusKm) };
  const reasons = [`${distanceKm.toFixed(1)} km straight-line from the confirmed search center.`];
  if (match) reasons.unshift(`Matches your ${propertyTypeLabel(preference).toLowerCase()} preference.`);
  return { score: factors.preferredType + factors.proximity, factors, reasons, distanceKm };
}
export function rankAccommodation(properties: Accommodation[], trip: Trip, center: GeoPoint, radiusKm: number) {
  return [...new Map(properties.map((property) => [property.id, property])).values()]
    .map((property) => ({ property, ...scoreAccommodation(property, trip, center, radiusKm) }))
    .filter((entry) => entry.distanceKm <= radiusKm)
    .sort((a, b) => b.score - a.score || (a.property.id < b.property.id ? -1 : a.property.id > b.property.id ? 1 : 0));
}
