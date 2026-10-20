import { isRealDateOnly } from '../../trips/validation/tripSchema';
import { tripDuration } from '../../trips/utils/tripFormatters';
import type { ActivityCandidate, ItineraryDay, ItineraryItem, PlanningConfig, PlanningContext } from '../types/itinerary';

export const paceRules = {
  relaxed: { maxActivities: 3, activityMinutes: 240, startMinute: 540, endMinute: 960 },
  balanced: { maxActivities: 4, activityMinutes: 360, startMinute: 540, endMinute: 1020 },
  active: { maxActivities: 6, activityMinutes: 480, startMinute: 540, endMinute: 1140 },
} as const;
export const lunch = { startMinute: 750, endMinute: 810 };

export function calendarDates(startDate: string, endDate: string) {
  if (!isRealDateOnly(startDate) || !isRealDateOnly(endDate) || endDate < startDate) throw new Error('Choose valid trip dates before generating an itinerary.');
  const count = tripDuration(startDate, endDate);
  if (count > 366) throw new Error('Itinerary planning currently supports trips up to 366 calendar days.');
  const [year, month, day] = startDate.split('-').map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year!, month! - 1, day);
  return Array.from({ length: count }, (_, index) => {
    const current = new Date(date.getTime());
    current.setUTCDate(date.getUTCDate() + index);
    return `${String(current.getUTCFullYear()).padStart(4, '0')}-${String(current.getUTCMonth() + 1).padStart(2, '0')}-${String(current.getUTCDate()).padStart(2, '0')}`;
  });
}

export function dayLimits(date: string, context: PlanningContext) {
  const rule = paceRules[context.pace];
  const provisional = date === context.startDate || date === context.endDate;
  const base = provisional ? { maxActivities: 2, activityMinutes: 180, startMinute: 600, endMinute: 960, provisional } : { ...rule, provisional };
  const startMinute = context.arrivalConstraint?.date === date ? Math.max(base.startMinute, context.arrivalConstraint.minute) : base.startMinute;
  const endMinute = context.departureConstraint?.date === date ? Math.min(base.endMinute, context.departureConstraint.minute) : base.endMinute;
  return { ...base, startMinute, endMinute, activityMinutes: Math.max(0, Math.min(base.activityMinutes, endMinute - startMinute)) };
}

function findStart(candidate: ActivityCandidate, date: string, earliest: number, duration: number, endMinute: number) {
  const windows = candidate.openingWindows?.filter((window) => window.date === date).sort((a, b) => a.startMinute - b.startMinute)
    ?? [{ date, startMinute: earliest, endMinute }];
  for (const window of windows) {
    let start = Math.max(earliest, window.startMinute);
    if (start < lunch.endMinute && start + duration > lunch.startMinute) start = lunch.endMinute;
    if (start + duration <= Math.min(window.endMinute, endMinute)) return start;
  }
  return null;
}

export function buildDaySchedule(day: ItineraryDay, catalog: ActivityCandidate[], context: PlanningContext, config: PlanningConfig): ItineraryDay {
  const limits = dayLimits(day.date, context);
  if (day.items.length > limits.maxActivities) throw new Error('This day has reached its activity limit for your travel pace.');
  let cursor = limits.startMinute;
  let activityMinutes = 0;
  const pool = new Map(catalog.map((candidate) => [candidate.id, candidate]));
  const items: ItineraryItem[] = day.items.map((item, index) => {
    const candidate = pool.get(item.activityId);
    if (!candidate) throw new Error('This activity is no longer in the saved candidate pool.');
    const duration = candidate.durationMinutes ?? config.unknownDurationMinutes;
    activityMinutes += duration;
    if (activityMinutes > limits.activityMinutes) throw new Error('This activity would exceed the day’s duration allowance.');
    const startMinute = findStart(candidate, day.date, cursor, duration, limits.endMinute);
    if (startMinute === null) throw new Error('This sequence does not fit the proposed day or known opening windows.');
    cursor = startMinute + duration + config.bufferMinutes;
    return { ...item, dayId: day.id, order: index, startMinute, endMinute: startMinute + duration, durationAssumed: candidate.durationMinutes === undefined };
  });
  const breaks: ItineraryDay['breaks'] = [];
  if (items.length) {
    for (let index = 1; index < items.length; index++) {
      const previous = items[index - 1]!;
      const item = items[index]!;
      if (item.startMinute > previous.endMinute) breaks.push({ startMinute: previous.endMinute, endMinute: item.startMinute, label: previous.endMinute <= lunch.startMinute && item.startMinute >= lunch.endMinute ? 'Lunch / free time and unallocated buffer' : 'Free time / unallocated buffer' });
    }
  }
  return { ...day, items, breaks, provisional: limits.provisional };
}

export function formatTime(minute: number) { return `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`; }
