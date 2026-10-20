import type { z } from 'zod';
import type { geoLocationSchema } from './location';

export type GeoPoint = z.infer<typeof geoLocationSchema>;
// Great-circle distance is a geographic filter, not a road distance or travel time.
export function distanceMeters(a: GeoPoint, b: GeoPoint) {
  const radians = (value: number) => value * Math.PI / 180;
  const value = Math.sin(radians(b.latitude - a.latitude) / 2) ** 2 + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(radians(b.longitude - a.longitude) / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(Math.min(1, value)), Math.sqrt(Math.max(0, 1 - value)));
}
