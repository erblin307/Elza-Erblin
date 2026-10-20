import { describe, expect, it } from 'vitest';
import { generateItinerary } from '../../itinerary/domain/generator';
import { editItinerary } from '../../itinerary/domain/editing';
import { candidate, generationOptions, testTrip } from '../../itinerary/tests/testData';
import { GeographicFixtureActivityProvider } from '../../itinerary/fixtures/GeographicFixtureActivityProvider';
import { activityCandidateSchema } from '../../itinerary/domain/validation';
import { displayLongitude, filterActivities, mapActivities, mapMarkers, validCoordinates, viewportFor } from '../domain/mapData';
import { attributionHtml, readTileConfig } from '../services/tileConfig';

const pool = [candidate('a', { location: { latitude: 41.89, longitude: 12.49 } }), candidate('b', { location: { latitude: 41.9, longitude: 12.48 } }), candidate('c')];
const plan = () => generateItinerary(testTrip, pool, generationOptions);
describe('Coordinate validation', () => {
  it.each([{ latitude: 0, longitude: 0 }, { latitude: -90, longitude: -180 }, { latitude: 90, longitude: 180 }])('accepts numeric endpoints including zero %j', (point) => expect(validCoordinates(point)).toBe(true));
  it.each([undefined, null, {}, { latitude: 91, longitude: 0 }, { latitude: 0, longitude: -181 }, { latitude: NaN, longitude: 0 }, { latitude: 0, longitude: Infinity }, { latitude: '41', longitude: '12' }, { latitude: null, longitude: 0 }])('rejects missing or invalid coordinates %j', (point) => expect(validCoordinates(point)).toBe(false));
});
describe('Itinerary map transformation', () => {
  it('preserves item identity, order, date and day while resolving the catalog', () => {
    const itinerary = plan(); const rows = mapActivities(testTrip.id, itinerary);
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      const day = itinerary.days.find((day) => day.id === row.dayId)!;
      expect(row.id).toBe(row.item.id); expect(row.date).toBe(day.date);
      expect(row.dayNumber).toBe(itinerary.days.indexOf(day) + 1);
      expect(row.candidate?.id).toBe(row.activityId);
    }
    expect(mapMarkers(rows)).toHaveLength(2);
    expect(mapMarkers(mapActivities(testTrip.id, itinerary)).map((entry) => entry.id)).toEqual(mapMarkers(rows).map((entry) => entry.id));
  });
  it('retains missing candidates and invalid coordinates as unmapped rows', () => {
    const itinerary = plan(); itinerary.catalog = itinerary.catalog.filter((entry) => entry.id !== 'a');
    itinerary.catalog.find((entry) => entry.id === 'b')!.location = { latitude: Infinity, longitude: 12 };
    const rows = mapActivities(testTrip.id, itinerary);
    expect(rows).toHaveLength(3); expect(mapMarkers(rows)).toEqual([]);
    expect(rows.find((entry) => entry.activityId === 'a')?.candidate).toBeUndefined();
  });
  it('rejects another trip artifact and absent itinerary', () => {
    expect(mapActivities('vienna', plan())).toEqual([]); expect(mapActivities(testTrip.id)).toEqual([]);
  });
  it('filters all days, one day, empty day and unmapped-only day', () => {
    const rows = mapActivities(testTrip.id, plan());
    expect(filterActivities(rows, 'all')).toHaveLength(3);
    expect(filterActivities(rows, rows[0]!.dayId)).toHaveLength(1);
    expect(filterActivities(rows, 'absent')).toEqual([]);
    const unknown = rows.find((entry) => !entry.location)!;
    expect(mapMarkers(filterActivities(rows, unknown.dayId))).toHaveLength(0);
  });
  it('derives removal, reorder, add and cross-day movement without marker persistence', () => {
    const original = plan(); const target = original.days[0]!.items[0]!;
    const moved = editItinerary(original, { type: 'move', itemId: target.id, dayId: original.days[1]!.id });
    expect(mapActivities(testTrip.id, moved).find((entry) => entry.id === target.id)?.dayId).toBe(original.days[1]!.id);
    expect(mapMarkers(filterActivities(mapActivities(testTrip.id, moved), original.days[0]!.id))).toHaveLength(0);
    const reordered = editItinerary(moved, { type: 'reorder', itemId: target.id, direction: 'up' });
    expect(mapActivities(testTrip.id, reordered).find((entry) => entry.id === target.id)?.item.order).toBe(0);
    const removed = editItinerary(reordered, { type: 'remove', itemId: target.id });
    expect(mapActivities(testTrip.id, removed).some((entry) => entry.id === target.id)).toBe(false);
    const restored = editItinerary(removed, { type: 'add', activityId: target.activityId, dayId: original.days[0]!.id });
    expect(mapActivities(testTrip.id, restored).some((entry) => entry.id === target.id)).toBe(true);
  });
});
describe('Viewport calculations', () => {
  it('returns no guessed center for zero markers', () => expect(viewportFor([])).toBeNull());
  it('handles one point and identical points as a single center', () => {
    const point = { location: { latitude: 0, longitude: 0 } };
    expect(viewportFor([point, point])).toMatchObject({ single: true, south: 0, west: 0 });
  });
  it('handles grouped, widely spaced and invalid mixed points', () => {
    expect(viewportFor(pool.filter((entry) => entry.location).map((entry) => ({ location: entry.location })))).toMatchObject({ south: 41.89, north: 41.9, west: 12.48, east: 12.49, single: false });
    expect(viewportFor([{ location: { latitude: -70, longitude: -120 } }, { location: { latitude: 70, longitude: 40 } }, { location: { latitude: NaN, longitude: 0 } }])).toMatchObject({ south: -70, north: 70, west: -120, east: 40 });
  });
  it('fits the short antimeridian arc without changing domain coordinates', () => {
    const points = [{ location: { latitude: 10, longitude: 179 } }, { location: { latitude: 12, longitude: -179 } }];
    const bounds = viewportFor(points)!;
    expect(bounds.east - bounds.west).toBe(2);
    expect(displayLongitude(-179, bounds.west)).toBe(181);
    expect(points[1]!.location.longitude).toBe(-179);
  });
});
describe('Provider configuration and geographic fixture policy', () => {
  it('only defaults to OSM in development; production needs explicit attribution', () => {
    expect(readTileConfig({ DEV: true })?.url).toContain('tile.openstreetmap.org');
    expect(readTileConfig({ DEV: false })).toBeNull();
    expect(readTileConfig({ VITE_MAP_TILE_URL: 'https://tiles.example/{z}/{x}/{y}.png' })).toBeNull();
  });
  it('accepts explicit HTTPS configuration and escapes attribution markup', () => {
    const config = readTileConfig({ VITE_MAP_TILE_URL: 'https://tiles.example/{z}/{x}/{y}.png', VITE_MAP_ATTRIBUTION_TEXT: 'Map & <source>', VITE_MAP_ATTRIBUTION_URL: 'https://example.org/license' })!;
    expect(attributionHtml(config)).toContain('Map &amp; &lt;source&gt;');
    expect(readTileConfig({ ...config, VITE_MAP_TILE_URL: 'http://tiles.example/{z}/{x}/{y}.png' })).toBeNull();
  });
  it('provides validated static landmark snapshots only on explicit fixture retrieval', async () => {
    const provider = new GeographicFixtureActivityProvider();
    const rome = await provider.searchCandidates(testTrip);
    const parsed = rome.candidates.map((entry) => activityCandidateSchema.parse(entry));
    expect(parsed.filter((entry) => entry.location)).toHaveLength(3);
    for (const entry of parsed.filter((entry) => entry.location)) { expect(entry.price).toBeUndefined(); expect(entry.durationMinutes).toBeUndefined(); expect(entry.description).toContain('https://www.wikidata.org'); }
    const vienna = await provider.searchCandidates({ ...testTrip, destination: 'Vienna' });
    expect(vienna.candidates.map((entry) => activityCandidateSchema.parse(entry)).filter((entry) => entry.location)).toHaveLength(1);
    expect((await provider.searchCandidates({ ...testTrip, destination: 'Unknown' })).candidates).toEqual([]);
  });
});
