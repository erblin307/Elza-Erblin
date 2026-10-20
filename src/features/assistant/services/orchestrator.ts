import type { Trip } from '../../trips/types/trip';
import type { TripRepository } from '../../trips/services/TripRepository';
import type { AssistantAction, AssistantResponse, ConversationEntry, Proposal } from '../domain/contracts';
import { previewAction } from '../domain/actions';
import { interpretLocal } from '../domain/intent';
import { answerQuestion, daySummary } from './context';
import { activityCost } from '../../itinerary/domain/costs';
import { dayLimits } from '../../itinerary/domain/scheduling';
import { getPlacesProvider, rankPlaces } from '../../places/services/placesService';
import { categoriesForInterests } from '../../places/domain/categories';
import { placeAlreadyPlanned } from '../../places/services/itineraryPlaces';
import { placeSchema, type Place } from '../../places/domain/normalization';
import type { PlacesProvider } from '../../places/services/placesProvider';
import { routingRuntime, type RoutingProvider } from '../../transport/services/routingProvider';
import { planSegments } from '../../transport/domain/planner';
import { formatMoney } from '../../budget/domain/engine';

const answer = (message: string, sources = ['Saved active Trip']): AssistantResponse => ({ kind: 'answer', message, sources });
const uid = () => crypto.randomUUID();
type StoredProposal = { value: Proposal; candidate?: Place; expires: number };

// One instance per repository/provider lifetime. Memory only: bounded histories, no second Trip store.
export class AssistantOrchestrator {
  private histories = new Map<string, ConversationEntry[]>();
  private proposals = new Map<string, StoredProposal>();
  private busy = new Set<string>();
  constructor(private repository: TripRepository, private published: (trip: Trip) => void = () => {}, private dependencies: { places?: PlacesProvider; routing?: RoutingProvider } = {}) {}
  history(tripId: string) { return structuredClone(this.histories.get(tripId) ?? []); }
  clear(tripId: string) { this.histories.delete(tripId); for (const [id, p] of this.proposals) if (p.value.tripId === tripId) this.proposals.delete(id); }
  private append(tripId: string, entry: ConversationEntry) {
    if (!this.histories.has(tripId) && this.histories.size >= 10) this.clear(this.histories.keys().next().value!);
    this.histories.set(tripId, [...(this.histories.get(tripId) ?? []), entry].slice(-40));
  }
  private async current(id: string) {
    const trip = await this.repository.get(id);
    if (!trip || trip.id !== id) throw new Error('The active Trip is unavailable.');
    return trip;
  }
  private propose(trip: Trip, action: AssistantAction, reason: string, candidate?: Place): AssistantResponse {
    const preview = previewAction(trip, action, candidate);
    for (const p of this.proposals.values()) if (p.value.tripId === trip.id && p.value.status === 'pending') p.value.status = 'cancelled';
    const value: Proposal = { id: uid(), tripId: trip.id, revision: trip.updatedAt, action: preview.action, title: preview.title, before: preview.before, after: preview.after, impact: preview.impact, status: 'pending' };
    this.proposals.set(value.id, { value, candidate, expires: Date.now() + 15 * 60_000 });
    if (this.proposals.size > 50) this.proposals.delete(this.proposals.keys().next().value!);
    return { kind: 'proposal', message: reason, sources: ['Saved Trip', 'Existing itinerary scheduler', 'Budget engine'], proposal: value };
  }
  private resolveActivity(trip: Trip, name: string) {
    const matches = trip.itinerary?.days.flatMap((day) => day.items.filter((item) => {
      const c = trip.itinerary!.catalog.find((entry) => entry.id === item.activityId);
      return item.id === name || c?.name.toLowerCase() === name.toLowerCase();
    })) ?? [];
    if (matches.length !== 1) throw new Error(matches.length ? `Which activity do you mean? Use its item ID: ${matches.map((i) => i.id).join(', ')}.` : 'That activity was not found. Use the exact name in quotes from the itinerary, or its item ID.');
    return matches[0]!;
  }
  private async alternatives(trip: Trip, signal?: AbortSignal, interests = trip.preferences?.interests ?? []) {
    const provider = this.dependencies.places ?? await getPlacesProvider('geoapify');
    if (!provider.configured) throw new Error('Places search is not configured. Saved itinerary and local commands remain available; no alternative prices or places are invented.');
    if (!trip.destinationResolution) throw new Error('Confirm this Trip’s destination in Places before searching alternatives.');
    const result = await provider.search({ destination: trip.destinationResolution, categories: categoriesForInterests(interests), name: '', radiusKm: 5 }, signal);
    signal?.throwIfAborted();
    return rankPlaces(result.places.filter((p) => placeSchema.safeParse(p).success && !placeAlreadyPlanned(trip, p) && (!interests.length || p.categories.some((c) => interests.includes(c)))), trip).slice(0, 5);
  }
  async ask(tripId: string, message: string, signal?: AbortSignal): Promise<AssistantResponse> {
    if (this.busy.has(tripId)) throw new Error('Wait for the current request to finish.');
    this.busy.add(tripId);
    try {
      const intent = interpretLocal(message);
      const trip = await this.current(tripId); signal?.throwIfAborted();
      this.append(tripId, { id: uid(), role: 'user', message: message.trim() });
      let response: AssistantResponse;
      if (intent.kind === 'read') response = answer(answerQuestion(trip, intent.topic, intent.day), [intent.topic === 'budget' ? 'Existing Budget engine · calculated from saved estimates and expenses' : 'Saved active Trip · source labels retained']);
      else if (intent.kind === 'pace') response = this.propose(trip, { type: 'update_travel_pace', pace: intent.pace }, 'Review this preference change. Your existing itinerary will be preserved.');
      else if (intent.kind === 'remove' || intent.kind === 'move' || intent.kind === 'reorder') {
        const item = this.resolveActivity(trip, intent.name);
        const action: AssistantAction = intent.kind === 'remove' ? { type: 'remove_activity', itemId: item.id } : intent.kind === 'reorder' ? { type: 'reorder_activity', itemId: item.id, direction: intent.direction! } : { type: 'move_activity', itemId: item.id, dayId: daySummary(trip, intent.day! - 1).id };
        response = this.propose(trip, action, 'Review the affected schedule before applying.');
      } else if (intent.kind === 'relax') {
        const d = daySummary(trip, intent.day - 1); const day = trip.itinerary!.days[intent.day - 1]!;
        const item = day.items.slice().reverse().find((i) => !i.manuallyAdded);
        if (!item || day.items.length < 2) response = answer('This day has fewer than two activities, or all removable suggestions were manually added. Use an explicit remove or move command to choose an activity.');
        else {
          const limits = dayLimits(day.date, trip.itinerary!.context);
          response = this.propose(trip, { type: 'remove_activity', itemId: item.id }, `Day ${d.number} has ${day.items.length} activities; its current scheduling limit is ${limits.maxActivities}. To leave more free time, remove the last automatically selected activity. This is a lighter option, not a claim that the day is overloaded. Manually added activities are preserved.`);
        }
      } else if (intent.kind === 'alternatives' || intent.kind === 'cheaper') {
        const target = intent.kind === 'alternatives' && intent.name ? this.resolveActivity(trip, intent.name) : undefined;
        const targetCandidate = trip.itinerary?.catalog.find((c) => c.id === target?.activityId);
        const day = intent.kind === 'cheaper' ? daySummary(trip, intent.day - 1) : undefined;
        const results = await this.alternatives(trip, signal, targetCandidate?.categories ?? trip.preferences?.interests ?? []);
        if (intent.kind === 'cheaper') {
          const priced = day!.activities.filter((a) => a.knownCost !== undefined && a.knownCost > 0).sort((a, b) => b.knownCost! - a.knownCost!);
          let proposed: AssistantResponse | undefined;
          for (const old of priced) {
            for (const { place } of results) {
              const cost = activityCost(place, { travelers: trip.travelers, currency: trip.budget.currency }).amount;
              if (cost === undefined || cost >= old.knownCost!) continue;
              try { proposed = this.propose(trip, { type: 'replace_activity', itemId: old.itemId, candidateId: place.id }, `Replace ${old.name} with ${place.name}. Known activity estimate difference: ${formatMoney(old.knownCost! - cost, trip.budget.currency)}. This is an estimate, not guaranteed savings.`, place); break; } catch { /* A candidate may not fit the existing schedule. */ }
            }
            if (proposed) break;
          }
          response = proposed ?? answer('No feasible lower-cost replacement with comparable known prices was returned. Unknown prices cannot establish savings.', ['Places provider', 'Existing scoring, scheduling and cost rules']);
        } else if (target && results.length) {
          const best = results[0]!;
          response = this.propose(trip, { type: 'replace_activity', itemId: target.id, candidateId: best.place.id }, `Suggested alternative: ${best.place.name}. ${best.reasons.join(' ')} Price and availability remain unknown unless supplied.`, best.place);
        } else response = answer(results.length ? results.map(({ place, reasons }) => `${place.name} · ${place.sourceName}\n${reasons.join(' ')}\nPrice: ${activityCost(place, { travelers: trip.travelers, currency: trip.budget.currency }).amount === undefined ? 'unknown' : 'source estimate available'}`).join('\n\n') + '\nTo preview a replacement, ask: find alternatives for "exact activity name".' : 'No matching unplanned alternatives were returned.', ['Existing Places provider · 5 km search', 'Existing recommendation scoring']);
      } else if (intent.kind === 'reduce_walking') {
        const d = daySummary(trip, intent.day - 1);
        const routing = this.dependencies.routing ?? routingRuntime.provider;
        if (!routing.configured) throw new Error('Routing is not configured. Walking alternatives and durations cannot be verified. Open Transport to review available modes.');
        const segment = planSegments(trip).find((s) => s.dayId === d.id && s.mode === 'walk' && s.request);
        if (!segment?.request) throw new Error('No current walking connection with verified endpoints is available on that day.');
        const walk = await routing.getRoute(segment.request, signal);
        signal?.throwIfAborted();
        const drive = await routing.getRoute({ ...segment.request, mode: 'drive' }, signal);
        signal?.throwIfAborted();
        response = this.propose(trip, { type: 'set_segment_mode', segmentId: segment.id, mode: 'drive' }, `For ${segment.from.name} → ${segment.to.name}, provider estimates: walking ${Math.ceil(walk.estimatedDurationSeconds / 60)} min (${Math.round(walk.distanceMeters)} m), driving ${Math.ceil(drive.estimatedDurationSeconds / 60)} min (${Math.round(drive.distanceMeters)} m). Preview changing this one connection to driving. Vehicle access, accessibility, traffic, parking and fares remain unverified.`);
      } else response = { kind: 'clarification', message: 'I support a limited set of local commands; no generative AI provider is connected. Try “help” for examples. For an activity change, include its exact name in quotes and a day number where needed.', sources: ['Local deterministic parser'] };
      signal?.throwIfAborted();
      this.append(tripId, { id: uid(), role: 'assistant', message: response.message, response });
      return structuredClone(response);
    } catch (error) {
      const response: AssistantResponse = { kind: 'error', message: error instanceof Error ? error.message : 'Assistant request failed. Saved Trip data is unchanged.', sources: [] };
      if (!signal?.aborted) this.append(tripId, { id: uid(), role: 'assistant', message: response.message, response });
      return response;
    } finally { this.busy.delete(tripId); }
  }
  cancel(tripId: string, proposalId: string) {
    const p = this.proposals.get(proposalId);
    if (!p || p.value.tripId !== tripId || p.value.status !== 'pending') throw new Error('This proposal is no longer pending for this Trip.');
    p.value.status = 'cancelled';
    this.append(tripId, { id: uid(), role: 'assistant', message: 'Proposal cancelled. Saved Trip data is unchanged.' });
  }
  async apply(tripId: string, proposalId: string): Promise<Trip> {
    const p = this.proposals.get(proposalId);
    if (this.busy.has(tripId) || !p || p.value.tripId !== tripId || p.value.status !== 'pending') throw new Error('This proposal is not available to apply.');
    this.busy.add(tripId); p.value.status = 'applying';
    try {
      const trip = await this.current(tripId);
      if (trip.updatedAt !== p.value.revision || Date.now() > p.expires) throw new Error('This proposal is stale. Ask again using the latest Trip.');
      const preview = previewAction(trip, p.value.action, p.candidate);
      let saved: Trip;
      if (preview.action.type === 'update_travel_pace') saved = await this.repository.update(tripId, preview.next, p.value.revision);
      else if (preview.action.type === 'set_segment_mode') saved = await this.repository.saveTransportSettings(tripId, preview.next.transportSettings!, p.value.revision);
      else saved = await this.repository.saveItinerary(tripId, preview.next.itinerary!, p.value.revision);
      p.value.status = 'applied'; this.published(saved);
      this.append(tripId, { id: uid(), role: 'assistant', message: 'Change saved. Connected Trip views now use the updated plan.' });
      return saved;
    } catch (error) { p.value.status = 'failed'; throw error; }
    finally { this.busy.delete(tripId); }
  }
}
