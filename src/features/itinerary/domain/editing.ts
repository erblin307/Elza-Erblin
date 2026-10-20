import type { GeneratedItinerary, ItineraryItem } from '../types/itinerary';
import { buildDaySchedule } from './scheduling';
import { itinerarySchema } from './validation';

export type ItineraryEdit =
  | { type: 'remove'; itemId: string }
  | { type: 'reorder'; itemId: string; direction: 'up' | 'down' }
  | { type: 'move'; itemId: string; dayId: string }
  | { type: 'add'; activityId: string; dayId: string };

export function editItinerary(itinerary: GeneratedItinerary, action: ItineraryEdit, updatedAt = new Date().toISOString()): GeneratedItinerary {
  const next = structuredClone(itinerary);
  if (action.type === 'add') {
    const day = next.days.find((day) => day.id === action.dayId);
    const candidate = next.catalog.find((candidate) => candidate.id === action.activityId);
    if (!day || !candidate) throw new Error('Choose an activity and an existing itinerary day.');
    if (next.days.some((day) => day.items.some((item) => item.activityId === action.activityId))) throw new Error('This activity is already in the itinerary.');
    const item: ItineraryItem = { id: `item-${next.catalog.findIndex((candidate) => candidate.id === action.activityId)}`, activityId: candidate.id, dayId: day.id, order: day.items.length, startMinute: 0, endMinute: 0, durationAssumed: false, manuallyAdded: true, reasons: ['Added manually from the saved candidate pool.'] };
    day.items.push(item);
  } else {
    const sourceDay = next.days.find((day) => day.items.some((item) => item.id === action.itemId));
    const index = sourceDay?.items.findIndex((item) => item.id === action.itemId) ?? -1;
    if (!sourceDay || index < 0) throw new Error('This itinerary activity no longer exists.');
    if (action.type === 'remove') sourceDay.items.splice(index, 1);
    if (action.type === 'reorder') {
      const targetIndex = index + (action.direction === 'up' ? -1 : 1);
      if (targetIndex < 0 || targetIndex >= sourceDay.items.length) throw new Error('This activity cannot move further in that direction.');
      [sourceDay.items[index], sourceDay.items[targetIndex]] = [sourceDay.items[targetIndex]!, sourceDay.items[index]!];
    }
    if (action.type === 'move') {
      const destinationDay = next.days.find((day) => day.id === action.dayId);
      if (!destinationDay) throw new Error('The destination day does not exist.');
      if (destinationDay.id === sourceDay.id) return itinerary;
      destinationDay.items.push(sourceDay.items.splice(index, 1)[0]!);
    }
  }
  next.days = next.days.map((day) => buildDaySchedule(day, next.catalog, next.context, next.config));
  next.metadata.manuallyAdjusted = true;
  next.metadata.updatedAt = updatedAt;
  const result = itinerarySchema.safeParse(next);
  if (!result.success) throw new Error('This change would violate the activity allowance or schedule constraints. Your saved plan is unchanged.');
  return result.data;
}
