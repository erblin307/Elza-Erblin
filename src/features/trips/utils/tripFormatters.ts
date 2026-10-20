import type { Trip, TripPreferences } from '../types/trip';
import { tripFilterLabels, tripLifecycle } from '../domain/tripLibrary';

export function paceDescription(pace: TripPreferences['pace']) {
  return { relaxed: 'Fewer activities, more free time.', balanced: 'A moderate daily schedule with time between activities.', active: 'More activities, busier days.' }[pace];
}

export function parseDateOnly(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(0);
  date.setFullYear(year!, month! - 1, day);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function formatDate(value: string, options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) {
  return new Intl.DateTimeFormat(undefined, options).format(parseDateOnly(value));
}

export function formatDateRange(startDate: string, endDate: string) {
  if (startDate === endDate) return formatDate(startDate);
  return `${formatDate(startDate, { day: 'numeric', month: 'short' })} – ${formatDate(endDate, { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

export function tripDuration(startDate: string, endDate: string) {
  // UTC is only a calendar arithmetic scale; displayed dates remain local.
  const calendarDay = (value: string) => {
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(0);
    date.setUTCFullYear(year!, month! - 1, day);
    return date.getTime();
  };
  const milliseconds = calendarDay(endDate) - calendarDay(startDate);
  return Math.round(milliseconds / 86_400_000) + 1;
}

export function durationLabel(startDate: string, endDate: string) {
  const days = tripDuration(startDate, endDate);
  return `${days} calendar ${days === 1 ? 'day' : 'days'} / ${days - 1} ${days === 2 ? 'night' : 'nights'}`;
}

export function preferenceLabel(value: string) {
  const labels: Record<string, string> = { any: 'No preference', public_transport: 'Public transport' };
  return labels[value] ?? value.charAt(0).toUpperCase() + value.slice(1);
}

export function formatBudget(trip: Pick<Trip, 'budget'>) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: trip.budget.currency, maximumFractionDigits: trip.budget.amount % 1 === 0 ? 0 : 2 }).format(trip.budget.amount);
}

export function tripStatus(trip: Trip) {
  return tripFilterLabels[tripLifecycle(trip)];
}
