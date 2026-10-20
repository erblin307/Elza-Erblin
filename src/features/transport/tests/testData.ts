import { generateItinerary } from '../../itinerary/domain/generator';
import { candidate, generationOptions, testTrip } from '../../itinerary/tests/testData';
import { createSelectedStay } from '../../accommodation/domain/accommodation';
import { property, stayTrip } from '../../accommodation/tests/testData';
import type { RouteRequest } from '../domain/routing';
export const routingTrip = { ...testTrip, destinationResolution: stayTrip.destinationResolution };
export const transportTrip = { ...routingTrip, itinerary: generateItinerary(routingTrip, Array.from({ length: 6 }, (_, index) => candidate(`point-${index}`, { location: { latitude: 41.89 + index * 0.001, longitude: 12.49 + index * 0.001 } })), generationOptions), selectedStay: createSelectedStay(routingTrip, property()) };
export const request: RouteRequest = { mode: 'walk', points: [{ latitude: 41.89, longitude: 12.49 }, { latitude: 41.90, longitude: 12.48 }] };
// Synthetic provider-envelope fixture, ONLY for tests/explicit development QA.
export function routeResponse(input = request, duration = 2400) {
  const coordinates = input.points.slice(1).map((point, index) => [[input.points[index]!.longitude, input.points[index]!.latitude], [point.longitude, point.latitude]]);
  return { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { mode: input.mode, distance: 1500 * coordinates.length, time: duration * coordinates.length, distance_units: 'meters', legs: coordinates.map(() => ({ distance: 1500, time: duration })) }, geometry: { type: 'MultiLineString', coordinates } }] };
}
