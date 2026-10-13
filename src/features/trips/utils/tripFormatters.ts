import type { Trip } from '../types/trip';

export function parseDateOnly(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year!, month! - 1, day);
}

export function formatDate(value: string, options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) {
  return new Intl.DateTimeFormat(undefined, options).format(parseDateOnly(value));
}

export function formatDateRange(startDate: string, endDate: string) {
  if (startDate === endDate) return formatDate(startDate);
  return `${formatDate(startDate, { day: 'numeric', month: 'short' })} – ${formatDate(endDate, { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

export function tripDuration(startDate: string, endDate: string) {
  const milliseconds = parseDateOnly(endDate).getTime() - parseDateOnly(startDate).getTime();
  return Math.round(milliseconds / 86_400_000) + 1;
}

export function formatBudget(trip: Trip) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: trip.budget.currency, maximumFractionDigits: trip.budget.amount % 1 === 0 ? 0 : 2 }).format(trip.budget.amount);
}

export function tripStatus(trip: Trip) {
  const today = new Date();
  const localToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  if (trip.endDate < localToday) return 'Past';
  if (trip.startDate <= localToday) return 'In progress';
  return 'Upcoming';
}
