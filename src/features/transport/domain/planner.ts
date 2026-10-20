import type { Trip } from '../../trips/types/trip';
import { mapActivities, validCoordinates } from '../../map/domain/mapData';
import { stayNeedsReview } from '../../accommodation/domain/accommodation';
import { isItineraryStale } from '../../itinerary/domain/context';
import type { GeoPoint } from '../../../shared/validation/geography';
import type { ItineraryItem } from '../../itinerary/types/itinerary';
import { routeKey, type RouteRequest, type TransportSettings, type TravelRoute } from './routing';

export type RouteEndpoint = { id: string; name: string; location?: GeoPoint; item?: ItineraryItem };
export type RouteSegment = { id: string; tripId: string; dayId: string; from: RouteEndpoint; to: RouteEndpoint; mode: RouteRequest['mode']; request?: RouteRequest; key?: string; unavailable?: string };
export function settingsFor(trip: Trip): TransportSettings {
  const preferred = trip.preferences?.transportation.find((mode) => mode !== 'public_transport');
  return trip.transportSettings ?? { defaultMode: preferred === 'car' ? 'drive' : preferred === 'bicycle' ? 'bicycle' : 'walk', hotelOrigin: false, hotelReturn: false, segmentModes: {} };
}
export function planSegments(trip: Trip, settings = settingsFor(trip)): RouteSegment[] {
  if (!trip.itinerary || trip.itinerary.tripId !== trip.id) return [];
  const activities = mapActivities(trip.id, trip.itinerary);
  const stale = isItineraryStale(trip, trip.itinerary);
  const stay = trip.selectedStay;
  const hotel: RouteEndpoint | undefined = stay ? { id: `stay-${stay.property.id}`, name: stay.property.name, location: !stayNeedsReview(trip) && validCoordinates(stay.property.location) ? stay.property.location : undefined } : undefined;
  return trip.itinerary.days.flatMap((day) => {
    const stops: RouteEndpoint[] = activities.filter((entry) => entry.dayId === day.id).map((entry) => ({ id: entry.id, name: entry.candidate?.name ?? 'Activity unavailable', location: entry.location, item: entry.item }));
    if (!stops.length) return [];
    if (settings.hotelOrigin && hotel) stops.unshift(hotel);
    if (settings.hotelReturn && hotel) stops.push(hotel);
    return stops.slice(1).map((to, index) => {
      const from = stops[index]!; const id = JSON.stringify([trip.id, day.id, from.id, to.id]);
      const mode = settings.segmentModes[id] ?? settings.defaultMode;
      const unavailable = stale ? 'Itinerary is outdated. Review or regenerate before routing.' : !from.location || !to.location ? 'Endpoint coordinates unavailable or planned stay needs review.' : undefined;
      const request = !unavailable ? { mode, points: [from.location!, to.location!] } : undefined;
      return { id, tripId: trip.id, dayId: day.id, from, to, mode, unavailable, request, key: request ? routeKey(request) : undefined };
    });
  });
}
export function detectTravelConflict(previous: Pick<ItineraryItem, 'endMinute'> | undefined, next: Pick<ItineraryItem, 'startMinute'> | undefined, durationSeconds?: number) {
  if (!previous || !next || durationSeconds === undefined || !Number.isFinite(durationSeconds) || durationSeconds < 0 || !Number.isFinite(previous.endMinute) || !Number.isFinite(next.startMinute)) return 'unknown';
  return previous.endMinute * 60 + durationSeconds > next.startMinute * 60 ? 'conflict' : 'fits';
}
export function dailyTotals(segments: RouteSegment[], lookup: (segment: RouteSegment) => TravelRoute | undefined) {
  const routes = segments.flatMap((segment) => lookup(segment) ?? []);
  return { complete: routes.length === segments.length, available: routes.length, total: segments.length, distanceMeters: routes.reduce((sum, route) => sum + route.distanceMeters, 0), durationSeconds: routes.reduce((sum, route) => sum + route.estimatedDurationSeconds, 0) };
}
