import { describe, expect, it } from 'vitest';
import { defaultWeights, isItineraryStale, planningContext } from '../domain/context';
import { activityCost, costSummary } from '../domain/costs';
import { editItinerary } from '../domain/editing';
import { generateItinerary } from '../domain/generator';
import { rankCandidates, scoreActivity } from '../domain/scoring';
import { calendarDates } from '../domain/scheduling';
import { activityCandidateSchema, itinerarySchema, validateCandidates } from '../domain/validation';
import { FixtureActivityProvider } from '../fixtures/FixtureActivityProvider';
import { generateTripItinerary, InsufficientActivityDataError } from '../services/itineraryGenerator';
import { candidate, candidatePool, generationOptions, testTrip } from './testData';

const config = { activityAllowance: 300, unknownDurationMinutes: 60, bufferMinutes: 30, weights: defaultWeights };

describe('Candidate normalization, scoring and costs', () => {
  it('ranks interest matches substantially above unrelated candidates', () => {
    const context = { ...planningContext(testTrip), interests: ['history'] as const };
    const scores = rankCandidates([candidate('unrelated', { categories: ['shopping'] }), candidate('matching')], { ...context, interests: [...context.interests] }, config);
    expect(scores[0]?.candidate.id).toBe('matching');
    expect(scores[0]!.factors.interest).toBe(60);
  });
  it('uses stable tie-breaking independent of input order', () => {
    const pool = [candidate('z'), candidate('a')];
    expect(rankCandidates(pool, planningContext(testTrip), config).map((entry) => entry.candidate.id)).toEqual(['a', 'z']);
    expect(rankCandidates(pool.reverse(), planningContext(testTrip), config).map((entry) => entry.candidate.id)).toEqual(['a', 'z']);
  });
  it('encourages an uncovered selected category', () => {
    const result = rankCandidates([candidate('a-history'), candidate('z-food', { categories: ['food'] })], planningContext(testTrip), config, new Set(['history']));
    expect(result[0]?.candidate.id).toBe('z-food');
  });
  it('does not fabricate quality or duration evidence', () => {
    const result = scoreActivity(candidate('unknown', { rating: undefined, durationMinutes: undefined, price: undefined }), planningContext(testTrip), config);
    expect(result.factors).toMatchObject({ quality: 0, duration: 0, budget: 0 });
    expect(result.reasons.join(' ')).not.toContain('cost fits');
  });
  it('only uses provider ratings as quality evidence', () => {
    const provider = scoreActivity(candidate('rated', { rating: 5 }), planningContext(testTrip), config);
    const fixture = scoreActivity(candidate('fixture', { source: 'fixture', rating: 5, price: undefined }), planningContext(testTrip), config);
    expect(provider.factors.quality).toBe(5);
    expect(fixture.factors.quality).toBe(0);
  });
  it('calculates per-person and group costs with explicit units', () => {
    expect(activityCost(candidate('person', { price: { amount: 18, currency: 'EUR', unit: 'person', basis: 'source_estimate' } }), planningContext(testTrip)).amount).toBe(36);
    expect(activityCost(candidate('group', { price: { amount: 18, currency: 'EUR', unit: 'group', basis: 'source_estimate' } }), planningContext(testTrip)).amount).toBe(18);
  });
  it('only calculates entry costs when the quantity is explicit', () => {
    const input = candidate('entry', { price: { amount: 8, currency: 'EUR', unit: 'entry', basis: 'source_estimate' } });
    expect(activityCost(input, planningContext(testTrip)).amount).toBeUndefined();
    expect(activityCost({ ...input, price: { ...input.price!, entriesRequired: 3 } }, planningContext(testTrip)).amount).toBe(24);
  });
  it('keeps unknown and different-currency costs non-comparable', () => {
    expect(activityCost(candidate('unknown', { price: undefined }), planningContext(testTrip)).amount).toBeUndefined();
    expect(activityCost(candidate('foreign', { price: { amount: 10, currency: 'USD', unit: 'person', basis: 'source_estimate' } }), planningContext(testTrip)).reason).toContain('no currency conversion');
  });
  it('rejects malformed data and conflicting duplicate IDs without crashing', () => {
    const invalid = { ...candidate('bad'), categories: ['invalid'], price: { amount: -5, currency: 'BTC', unit: 'person' } };
    const result = validateCandidates([candidate('good'), candidate('duplicate'), candidate('duplicate'), invalid]);
    expect(result.candidates.map((entry) => entry.id)).toEqual(['good']);
    expect(result.rejectedCount).toBe(3);
  });
  it.each([{ location: { latitude: 100, longitude: 0 } }, { durationMinutes: -1 }, { rating: 6 }, { sourceName: '' }, { price: { amount: NaN, currency: 'EUR', unit: 'person', basis: 'source_estimate' } }])('rejects invalid metadata %j', (changes) => {
    expect(activityCandidateSchema.safeParse({ ...candidate('invalid'), ...changes }).success).toBe(false);
  });
});

describe('Deterministic itinerary generation', () => {
  it('produces the same complete output for identical context and reversed candidate order', () => {
    const pool = candidatePool();
    expect(generateItinerary(testTrip, pool, generationOptions)).toEqual(generateItinerary(testTrip, pool.reverse(), generationOptions));
  });
  it.each([1, 3, 7])('generates exactly %s calendar days', (count) => {
    const trip = { ...testTrip, endDate: `2027-06-${String(11 + count).padStart(2, '0')}` };
    const output = generateItinerary(trip, candidatePool(), generationOptions);
    expect(output.days).toHaveLength(count);
    expect(output.days[0]?.date).toBe(trip.startDate);
    expect(output.days.at(-1)?.date).toBe(trip.endDate);
    expect(output.days[0]?.provisional).toBe(true);
    expect(output.days.at(-1)?.provisional).toBe(true);
  });
  it.each([['relaxed', 3], ['balanced', 4], ['active', 6]] as const)('respects %s pace and provisional boundary days', (pace, count) => {
    const trip = { ...testTrip, preferences: { ...testTrip.preferences!, pace } };
    const output = generateItinerary(trip, candidatePool(), generationOptions);
    expect(output.days[1]?.items).toHaveLength(count);
    expect(output.days[0]?.items).toHaveLength(2);
    expect(output.days.at(-1)?.items).toHaveLength(2);
  });
  it('does not force long activities into a day', () => {
    const output = generateItinerary(testTrip, candidatePool().map((entry) => ({ ...entry, durationMinutes: 180 })), generationOptions);
    expect(output.days[0]?.items).toHaveLength(0);
    expect(output.days[1]?.items).toHaveLength(2);
  });
  it('avoids duplicates and distributes selected interests', () => {
    const output = generateItinerary(testTrip, candidatePool(), generationOptions);
    const items = output.days.flatMap((day) => day.items);
    expect(new Set(items.map((item) => item.activityId)).size).toBe(items.length);
    const categories = new Set(items.flatMap((item) => output.catalog.find((candidate) => candidate.id === item.activityId)!.categories));
    expect(categories).toEqual(new Set(['history', 'food', 'architecture']));
  });
  it('uses the activity allowance rather than the complete trip budget', () => {
    const pool = candidatePool().map((entry) => ({ ...entry, price: { amount: 10, currency: 'EUR' as const, unit: 'person' as const, basis: 'source_estimate' as const } }));
    const output = generateItinerary(testTrip, pool, { ...generationOptions, activityAllowance: 40 });
    expect(output.days.flatMap((day) => day.items)).toHaveLength(2);
    expect(costSummary(output.days.flatMap((day) => day.items), output.catalog, output.context)).toMatchObject({ knownCost: 40, unknownCount: 0 });
    expect(output.config.activityAllowance).toBe(40);
  });
  it('can plan unknown-cost activities at zero known allowance without calling them free', () => {
    const output = generateItinerary(testTrip, [candidate('unknown', { price: undefined }), candidate('expensive', { price: { amount: 10, currency: 'EUR', unit: 'group', basis: 'source_estimate' } })], { ...generationOptions, activityAllowance: 0 });
    const items = output.days.flatMap((day) => day.items);
    expect(items.map((item) => item.activityId)).toEqual(['unknown']);
    expect(costSummary(items, output.catalog, output.context)).toEqual({ knownCost: 0, unknownCount: 1 });
  });
  it('supports no selected interests without manufacturing preferences', () => {
    const output = generateItinerary({ ...testTrip, preferences: { ...testTrip.preferences!, interests: [] } }, candidatePool(), generationOptions);
    expect(output.days.flatMap((day) => day.items).length).toBeGreaterThan(0);
    expect(output.context.interests).toEqual([]);
  });
  it('handles empty and insufficient candidate pools honestly', () => {
    const empty = generateItinerary(testTrip, [], generationOptions);
    expect(empty.days).toHaveLength(3);
    expect(empty.days.flatMap((day) => day.items)).toEqual([]);
    const sparse = generateItinerary(testTrip, [candidate('only')], generationOptions);
    expect(sparse.days.flatMap((day) => day.items)).toHaveLength(1);
    expect(sparse.metadata.warnings.join(' ')).toContain('limited');
  });
  it('excludes candidates from other destinations and unrelated categories', () => {
    const output = generateItinerary(testTrip, [candidate('foreign', { destination: 'vienna' }), candidate('unrelated', { categories: ['shopping'] })], generationOptions);
    expect(output.days.flatMap((day) => day.items)).toEqual([]);
  });
  it('uses a disclosed duration assumption and never invents coordinates or hours', () => {
    const output = generateItinerary(testTrip, [candidate('unknown', { durationMinutes: undefined, location: undefined, openingWindows: undefined })], generationOptions);
    const item = output.days[0]!.items[0]!;
    expect(item.durationAssumed).toBe(true);
    expect(item.endMinute - item.startMinute).toBe(60);
    expect(output.catalog[0]?.location).toBeUndefined();
    expect(output.catalog[0]?.openingWindows).toBeUndefined();
  });
  it('respects supplied opening windows instead of inventing availability', () => {
    const output = generateItinerary(testTrip, [candidate('hours', { openingWindows: [{ date: '2027-06-13', startMinute: 840, endMinute: 960 }] })], generationOptions);
    expect(output.days[0]?.items).toHaveLength(0);
    expect(output.days[1]?.items[0]?.startMinute).toBe(840);
    expect(output.days[2]?.items).toHaveLength(0);
  });
  it('keeps breaks separate from activities and reserves lunch/gaps', () => {
    const output = generateItinerary(testTrip, candidatePool(), generationOptions);
    expect(output.days[1]!.breaks.length).toBeGreaterThan(0);
    expect(output.days[1]!.items.every((item) => !(item.startMinute < 810 && item.endMinute > 750))).toBe(true);
    expect(itinerarySchema.safeParse(output).success).toBe(true);
  });
  it('uses date-only arithmetic across leap days and month boundaries', () => {
    expect(calendarDates('2028-02-28', '2028-03-01')).toEqual(['2028-02-28', '2028-02-29', '2028-03-01']);
  });
  it.each([['2027-02-30', '2027-03-01'], ['2027-06-17', '2027-06-12']])('rejects invalid dates %s–%s', (startDate, endDate) => {
    expect(() => generateItinerary({ ...testTrip, startDate, endDate }, candidatePool(), generationOptions)).toThrow();
  });
  it('rejects negative, non-finite, and excessive allowances', () => {
    for (const activityAllowance of [-1, Infinity, 2000]) expect(() => generateItinerary(testTrip, candidatePool(), { ...generationOptions, activityAllowance })).toThrow();
  });
  it('only retrieves fixtures for explicit demonstration requests and supported destinations', async () => {
    await expect(generateTripItinerary(testTrip, 300, 'live')).rejects.toBeInstanceOf(InsufficientActivityDataError);
    const result = await generateTripItinerary(testTrip, 300, 'demo');
    expect(result.metadata.dataMode).toBe('demo');
    expect(result.catalog.every((candidate) => candidate.source === 'fixture')).toBe(true);
    expect((await new FixtureActivityProvider().searchCandidates({ ...testTrip, destination: 'Unknown destination' })).candidates).toEqual([]);
    await expect(generateTripItinerary({ ...testTrip, destination: 'Unknown destination' }, 300, 'demo')).rejects.toBeInstanceOf(InsufficientActivityDataError);
  });
});

describe('Manual itinerary editing and integrity', () => {
  const plan = () => generateItinerary(testTrip, candidatePool(4), generationOptions);
  it('removes the intended occurrence without deleting the candidate or other items', () => {
    const original = plan(); const target = original.days[0]!.items[0]!;
    const changed = editItinerary(original, { type: 'remove', itemId: target.id });
    expect(changed.days.flatMap((day) => day.items).some((item) => item.id === target.id)).toBe(false);
    expect(changed.catalog).toEqual(original.catalog);
    expect(original.days.flatMap((day) => day.items)).toHaveLength(4);
    expect(changed.metadata.manuallyAdjusted).toBe(true);
  });
  it('reorders and renumbers activities while preserving their stable IDs', () => {
    const original = plan(); const day = original.days[0]!;
    const changed = editItinerary(original, { type: 'reorder', itemId: day.items[1]!.id, direction: 'up' });
    expect(changed.days[0]!.items.map((item) => item.id)).toEqual([...day.items.map((item) => item.id)].reverse());
    expect(changed.days[0]!.items.map((item) => item.order)).toEqual([0, 1]);
  });
  it('moves an item to another existing day and preserves unrelated days', () => {
    const original = plan(); const target = original.days[0]!.items[0]!;
    const changed = editItinerary(original, { type: 'move', itemId: target.id, dayId: original.days[1]!.id });
    expect(changed.days[1]!.items.some((item) => item.id === target.id)).toBe(true);
    expect(changed.days[2]).toEqual(original.days[2]);
    expect(changed.days.flatMap((day) => day.items)).toHaveLength(4);
  });
  it('adds a removed candidate once from the existing catalog', () => {
    const original = plan(); const item = original.days[0]!.items[0]!;
    const removed = editItinerary(original, { type: 'remove', itemId: item.id });
    const restored = editItinerary(removed, { type: 'add', activityId: item.activityId, dayId: original.days[0]!.id });
    expect(restored.days[0]!.items.at(-1)?.manuallyAdded).toBe(true);
    expect(() => editItinerary(restored, { type: 'add', activityId: item.activityId, dayId: original.days[1]!.id })).toThrow('already');
  });
  it('rejects unknown items/days, capacity violations and duplicate references', () => {
    const original = plan();
    expect(() => editItinerary(original, { type: 'remove', itemId: 'absent' })).toThrow();
    expect(() => editItinerary(original, { type: 'move', itemId: original.days[0]!.items[0]!.id, dayId: 'absent' })).toThrow();
    expect(() => editItinerary(original, { type: 'move', itemId: original.days[1]!.items[0]!.id, dayId: original.days[0]!.id })).toThrow('limit');
    const tampered = structuredClone(original); tampered.days[1]!.items.push(tampered.days[0]!.items[0]!);
    expect(itinerarySchema.safeParse(tampered).success).toBe(false);
  });
  it('detects meaningful trip changes while ignoring display titles and free-text notes', () => {
    const original = plan();
    expect(isItineraryStale(testTrip, original)).toBe(false);
    for (const changed of [{ ...testTrip, destination: 'Vienna' }, { ...testTrip, endDate: '2027-06-15' }, { ...testTrip, travelers: 3 }, { ...testTrip, budget: { amount: 100, currency: 'EUR' as const } }, { ...testTrip, preferences: { ...testTrip.preferences!, pace: 'active' as const } }]) expect(isItineraryStale(changed, original)).toBe(true);
    expect(isItineraryStale({ ...testTrip, title: 'New label', preferences: { ...testTrip.preferences!, notes: 'Unstructured text' } }, original)).toBe(false);
  });
});
