import { z } from 'zod';
import { geoLocationSchema } from '../../../shared/validation/location';
import { distanceMeters, type GeoPoint } from '../../../shared/validation/geography';

export const transportModes = ['walk', 'drive', 'bicycle'] as const;
export type TransportMode = typeof transportModes[number];
export const modeLabels = { walk: 'Walking', drive: 'Driving', bicycle: 'Cycling' };
export const transportSettingsSchema = z.object({
  defaultMode: z.enum(transportModes), hotelOrigin: z.boolean(), hotelReturn: z.boolean(),
  segmentModes: z.record(z.string().max(2000), z.enum(transportModes)).refine((entries) => Object.keys(entries).length <= 500),
});
export type TransportSettings = z.infer<typeof transportSettingsSchema>;
export const routeRequestSchema = z.object({ mode: z.enum(transportModes), points: z.array(geoLocationSchema).min(2).max(10) });
export type RouteRequest = z.infer<typeof routeRequestSchema>;
const position = z.tuple([z.number().finite().min(-180).max(180), z.number().finite().min(-90).max(90)]);
const line = z.array(position).min(2).max(20000);
export const geometrySchema = z.discriminatedUnion('type', [z.object({ type: z.literal('LineString'), coordinates: line }), z.object({ type: z.literal('MultiLineString'), coordinates: z.array(line).min(1).max(9) })]).refine((geometry) => (geometry.type === 'LineString' ? geometry.coordinates.length : geometry.coordinates.reduce((sum, points) => sum + points.length, 0)) <= 20000, 'Route geometry exceeds the supported point limit.');
export type RouteGeometry = z.infer<typeof geometrySchema>;
export type TravelRoute = { provider: 'geoapify'; source: 'provider'; request: RouteRequest; distanceMeters: number; estimatedDurationSeconds: number; geometry: RouteGeometry; legs: { distance: number; time: number }[]; calculatedAt: string };
export const routeLifetimeMs = 300_000;
export function waypoint(point: GeoPoint) { return `${point.latitude},${point.longitude}`; }
export function geoJSONPoint(point: readonly [number, number]): GeoPoint { return { latitude: point[1], longitude: point[0] }; }
export function leafletLines(geometry: RouteGeometry): [number, number][][] {
  return (geometry.type === 'LineString' ? [geometry.coordinates] : geometry.coordinates).map((points) => points.map(([longitude, latitude]) => [latitude, longitude]));
}
export function routeKey(request: RouteRequest) { return JSON.stringify(['geoapify-routing-v1', 'balanced', 'metric', 'free_flow', false, request.mode, request.points.map(waypoint)]); }
export function normalizeRoute(raw: unknown, request: RouteRequest, calculatedAt: string): TravelRoute {
  routeRequestSchema.parse(request);
  const metric = z.number().finite().nonnegative();
  const parsed = z.object({ type: z.literal('FeatureCollection'), features: z.array(z.object({
    type: z.literal('Feature'), geometry: geometrySchema,
    properties: z.object({ mode: z.enum(transportModes), distance: metric, time: metric, distance_units: z.literal('meters'), legs: z.array(z.object({ distance: metric, time: metric })).min(1).max(9) }),
  })).min(1).max(1) }).safeParse(raw);
  if (!parsed.success) throw new Error('Route unavailable for the selected transportation mode. The provider returned no usable geometry or metrics.');
  const route = parsed.data.features[0]!; const p = route.properties;
  const lines = route.geometry.type === 'LineString' ? [route.geometry.coordinates] : route.geometry.coordinates;
  if (p.mode !== request.mode || p.legs.length !== request.points.length - 1 || lines.length !== p.legs.length) throw new Error('Route mode or leg structure does not match the request.');
  if (Math.abs(p.legs.reduce((sum, leg) => sum + leg.distance, 0) - p.distance) > Math.max(2, p.legs.length) || Math.abs(p.legs.reduce((sum, leg) => sum + leg.time, 0) - p.time) > Math.max(2, p.legs.length)) throw new Error('Route totals are inconsistent with its legs.');
  // Provider snapping is permitted, but a route in a different area is not.
  if (lines.some((points, index) => distanceMeters(geoJSONPoint(points[0]!), request.points[index]!) > 1000 || distanceMeters(geoJSONPoint(points.at(-1)!), request.points[index + 1]!) > 1000)) throw new Error('Route geometry does not connect the requested locations.');
  return { provider: 'geoapify', source: 'provider', request, distanceMeters: p.distance, estimatedDurationSeconds: p.time, geometry: route.geometry, legs: p.legs, calculatedAt };
}
export function formatDistance(meters: number) { return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`; }
export function formatDuration(seconds: number) { const minutes = Math.ceil(seconds / 60); return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} hr${minutes % 60 ? ` ${minutes % 60} min` : ''}`; }
