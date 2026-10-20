import { actionSchema, type AssistantAction } from './contracts';
import { defaultPreferences, type Trip } from '../../trips/types/trip';
import { editItinerary } from '../../itinerary/domain/editing';
import { isItineraryStale } from '../../itinerary/domain/context';
import { planSegments, settingsFor } from '../../transport/domain/planner';
import { addDiscoveredPlace } from '../../places/services/itineraryPlaces';
import type { Place } from '../../places/domain/normalization';
import { calculateBudget, formatMoney } from '../../budget/domain/engine';
import { clockLabel } from '../services/context';

export function previewAction(trip: Trip, input: unknown, candidate?: Place) {
  const action = actionSchema.parse(input);
  let next: Trip;
  let before: string; let after: string; let title: string;
  if (action.type === 'update_travel_pace') {
    before = trip.preferences?.pace ?? 'balanced'; after = action.pace; title = 'Update travel pace';
    if (before === after) throw new Error('This Trip already uses that pace.');
    next = { ...trip, preferences: { ...(trip.preferences ?? defaultPreferences()), pace: action.pace } };
  } else if (action.type === 'set_segment_mode') {
    const segment = planSegments(trip).find((s) => s.id === action.segmentId);
    if (!segment?.request) throw new Error('This route segment is unavailable or outdated.');
    if (segment.mode === action.mode) throw new Error('This segment already uses that mode.');
    const settings = settingsFor(trip);
    before = `${segment.from.name} → ${segment.to.name}: ${segment.mode}`; after = action.mode; title = 'Change local transport mode';
    next = { ...trip, transportSettings: { ...settings, segmentModes: { ...settings.segmentModes, [segment.id]: action.mode } } };
  } else {
    const itinerary = trip.itinerary;
    if (!itinerary || itinerary.tripId !== trip.id) throw new Error('Generate an itinerary for this Trip first.');
    if (isItineraryStale(trip, itinerary)) throw new Error('The itinerary is outdated. Review or regenerate it before assistant changes.');
    const day = itinerary.days.find((d) => d.items.some((i) => i.id === action.itemId));
    const item = day?.items.find((i) => i.id === action.itemId);
    const activity = itinerary.catalog.find((c) => c.id === item?.activityId);
    if (!day || !item || !activity) throw new Error('That activity no longer exists in this Trip.');
    const describe = (value: typeof itinerary) => value.days.filter((d) => d.id === day.id || (action.type === 'move_activity' && d.id === action.dayId)).map((d) => `Day ${value.days.indexOf(d) + 1} (${d.date}):\n${d.items.map((i) => `${clockLabel(i.startMinute)}–${clockLabel(i.endMinute)} ${value.catalog.find((c) => c.id === i.activityId)?.name ?? 'Unknown activity'}${i.manuallyAdded ? ' [manually added]' : ''}`).join('\n') || 'No scheduled activities'}`).join('\n\n');
    before = describe(itinerary); title = `${action.type.replaceAll('_', ' ')}: ${activity.name}`;
    let edited = itinerary;
    if (action.type === 'remove_activity') edited = editItinerary(itinerary, { type: 'remove', itemId: item.id });
    if (action.type === 'move_activity') {
      if (day.id === action.dayId) throw new Error('The activity is already on that day.');
      edited = editItinerary(itinerary, { type: 'move', itemId: item.id, dayId: action.dayId });
    }
    if (action.type === 'reorder_activity') edited = editItinerary(itinerary, { type: 'reorder', itemId: item.id, direction: action.direction });
    if (action.type === 'replace_activity') {
      edited = editItinerary(itinerary, { type: 'remove', itemId: item.id });
      if (candidate) {
        if (candidate.id !== action.candidateId) throw new Error('Alternative identity mismatch.');
        edited = addDiscoveredPlace({ ...trip, itinerary: edited }, candidate, day.id);
      } else edited = editItinerary(edited, { type: 'add', activityId: action.candidateId, dayId: day.id });
    }
    next = { ...trip, itinerary: edited }; after = describe(edited);
  }
  const b = calculateBudget(trip); const a = calculateBudget(next);
  const impact = `Known forecast: ${formatMoney(b.total, trip.budget.currency)} → ${formatMoney(a.total, trip.budget.currency)}. Paid expenses stay unchanged. Unknown costs and transfers remain unknown.${action.type === 'update_travel_pace' ? ' Existing itinerary is preserved and may require review.' : ' Related map locations, route connections and Budget projections update from the saved Trip.'}`;
  return { action: action as AssistantAction, next, title, before, after, impact };
}
