import type { ActivityCandidate, GeneratedItinerary, ItineraryItem } from '../../itinerary/types/itinerary';
import type { Accommodation, SelectedStay } from '../../accommodation/domain/accommodation';

export type Location = NonNullable<ActivityCandidate['location']>;
export function validCoordinates(value: unknown): value is Location {
  if (typeof value !== 'object' || value === null) return false;
  const point = value as Partial<Location>;
  return typeof point.latitude === 'number' && Number.isFinite(point.latitude) && Math.abs(point.latitude) <= 90
    && typeof point.longitude === 'number' && Number.isFinite(point.longitude) && Math.abs(point.longitude) <= 180;
}
export type MapActivity = {
  id: string; activityId: string; dayId: string; dayNumber: number; date: string;
  item: ItineraryItem; candidate?: ActivityCandidate; location?: Location;
};
export type ItineraryMapMarker = MapActivity & { location: Location; candidate: ActivityCandidate };
export type AccommodationMapMarker = { id: string; kind: 'accommodation'; property: Accommodation; location: Location; planned: boolean };
export function accommodationMarker(property: Accommodation, planned = false): AccommodationMapMarker {
  return { id: `stay-${property.id}`, kind: 'accommodation', property, location: property.location, planned };
}
export function selectedStayMarker(tripId: string, stay?: SelectedStay): AccommodationMapMarker | null {
  return stay?.tripId === tripId && validCoordinates(stay.property.location) ? accommodationMarker(stay.property, true) : null;
}
export function mapActivities(tripId: string, itinerary?: GeneratedItinerary): MapActivity[] {
  if (!itinerary || itinerary.tripId !== tripId) return [];
  const catalog = new Map(itinerary.catalog.map((entry) => [entry.id, entry]));
  return itinerary.days.flatMap((day, index) => day.items.map((item) => {
    const candidate = catalog.get(item.activityId);
    return { id: item.id, activityId: item.activityId, dayId: day.id, dayNumber: index + 1, date: day.date, item, candidate,
      location: validCoordinates(candidate?.location) ? candidate.location : undefined };
  }));
}
export function filterActivities(activities: MapActivity[], dayId: string) {
  return dayId === 'all' ? activities : activities.filter((entry) => entry.dayId === dayId);
}
export function mapMarkers(activities: MapActivity[]): ItineraryMapMarker[] {
  return activities.filter((entry): entry is ItineraryMapMarker => !!entry.candidate && validCoordinates(entry.location));
}

// Choose the smallest longitude arc, including locations straddling the antimeridian.
export function viewportFor(markers: { location: unknown }[]) {
  const points = markers.map((entry) => entry.location).filter(validCoordinates);
  if (!points.length) return null;
  const longitudes = points.map((point) => point.longitude < 0 ? point.longitude + 360 : point.longitude).sort((a, b) => a - b);
  let gapIndex = 0; let largestGap = -1;
  for (let index = 0; index < longitudes.length; index++) {
    const gap = (longitudes[(index + 1) % longitudes.length]! + (index === longitudes.length - 1 ? 360 : 0)) - longitudes[index]!;
    if (gap > largestGap) { largestGap = gap; gapIndex = index; }
  }
  let west = longitudes[(gapIndex + 1) % longitudes.length]!;
  let east = longitudes[gapIndex]!;
  if (east < west) east += 360;
  if (west > 180) { west -= 360; east -= 360; }
  const south = Math.min(...points.map((point) => point.latitude));
  const north = Math.max(...points.map((point) => point.latitude));
  return { south, north, west, east, single: south === north && west === east };
}
export function displayLongitude(longitude: number, west: number) {
  return longitude < west ? longitude + 360 : longitude;
}
