import type { Trip } from '../types/trip';

export const tripFilters = ['all', 'upcoming', 'in_progress', 'past'] as const;
export type TripFilter = (typeof tripFilters)[number];
export const tripFilterLabels: Record<TripFilter, string> = { all: 'All', upcoming: 'Upcoming', in_progress: 'In progress', past: 'Past' };

export const tripSorts = ['updated', 'upcoming', 'created', 'destination'] as const;
export type TripSort = (typeof tripSorts)[number];
export const tripSortLabels: Record<TripSort, string> = { updated: 'Recently updated', upcoming: 'Upcoming departures', created: 'Recently created', destination: 'Destination name' };

export function localToday() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function tripLifecycle(trip: Pick<Trip, 'startDate' | 'endDate'>, today = localToday()): Exclude<TripFilter, 'all'> {
  if (trip.endDate < today) return 'past';
  if (trip.startDate <= today) return 'in_progress';
  return 'upcoming';
}

export function normalizedTripSearch(value: string) {
  return value.normalize('NFKD').replace(/\p{M}/gu, '').trim().replace(/\s+/gu, ' ').toLocaleLowerCase();
}

export function visibleTrips(trips: Trip[], query: string, filter: TripFilter, sort: TripSort, today = localToday()) {
  const needle = normalizedTripSearch(query);
  const filtered = trips.filter((trip) => {
    const matchesText = !needle || [trip.title, trip.destination, trip.origin].some((value) => normalizedTripSearch(value).includes(needle));
    return matchesText && (filter === 'all' || tripLifecycle(trip, today) === filter);
  });
  return filtered.slice().sort((left, right) => {
    if (sort === 'updated') return right.updatedAt.localeCompare(left.updatedAt) || left.id.localeCompare(right.id);
    if (sort === 'created') return right.createdAt.localeCompare(left.createdAt) || left.id.localeCompare(right.id);
    if (sort === 'destination') return left.destination.localeCompare(right.destination, undefined, { sensitivity: 'base' }) || left.startDate.localeCompare(right.startDate) || left.id.localeCompare(right.id);
    const leftPast = tripLifecycle(left, today) === 'past'; const rightPast = tripLifecycle(right, today) === 'past';
    if (leftPast !== rightPast) return leftPast ? 1 : -1;
    return leftPast ? right.startDate.localeCompare(left.startDate) : left.startDate.localeCompare(right.startDate) || left.id.localeCompare(right.id);
  });
}
