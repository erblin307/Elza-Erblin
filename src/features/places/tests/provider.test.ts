import { afterEach, describe, expect, it, vi } from 'vitest';
import { RequestClient, ProviderError } from '../../../shared/services/requestClient';
import { normalizeDestinations, normalizePlaces } from '../domain/normalization';
import { GeoapifyPlacesProvider, GeoapifyCandidateProvider } from '../services/geoapifyProvider';
import { categoriesForInterests, translateCategories } from '../domain/categories';
import { testTrip } from '../../itinerary/tests/testData';
import { collection, feature, place, resolution, response, timestamp } from './testData';

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
describe('Geoapify normalization and category translation', () => {
  it('normalizes stable provider identity, address, reference and real coordinates without inferred prices', () => {
    const result = place(); expect(result.id).toBe('geoapify-place-colosseum'); expect(result.location.latitude).toBe(41.890278); expect(result.place.address).toBe('Rome, Italy'); expect(result.place.references.wikidataId).toBe('Q10285'); expect(result.price).toBeUndefined(); expect(result.rating).toBeUndefined(); expect(result.durationMinutes).toBeUndefined();
  });
  it.each([{ name: '' }, { name: undefined }, { lat: 91 }, { lon: Infinity }, { lat: '41' }, { place_id: '' }, { categories: ['invented.category'] }])('rejects malformed place without losing healthy records %j', (fields) => {
    const result = normalizePlaces(collection(feature('valid'), feature('invalid', fields), null), 'Rome', resolution.providerId, timestamp);
    expect(result.places).toHaveLength(1); expect(result.rejectedCount).toBe(2);
  });
  it('handles missing address and unsafe optional URLs without inventing values', () => {
    const result = place('optional', { formatted: undefined, website: 'javascript:alert(1)' });
    expect(result.place.address).toBeUndefined(); expect(result.place.website).toBeUndefined();
  });
  it('merges duplicate provider categories while retaining separately identified same-name places', () => {
    const result = normalizePlaces(collection(feature('one'), feature('one', { categories: ['entertainment.museum'] }), feature('two')), 'Rome', resolution.providerId, timestamp);
    expect(result.places).toHaveLength(2); expect(result.places[0]!.categories).toContain('museums'); expect(result.places[0]!.place.providerCategories).toHaveLength(2);
  });
  it('quarantines conflicting duplicate coordinates including a third repeated record', () => {
    expect(normalizePlaces(collection(feature('same'), feature('same', { lat: 20 }), feature('same')), 'Rome', resolution.providerId, timestamp).places).toEqual([]);
  });
  it('handles empty envelopes but rejects malformed top-level responses', () => {
    expect(normalizePlaces(collection(), 'Rome', resolution.providerId, timestamp).places).toEqual([]);
    expect(() => normalizePlaces({}, 'Rome', resolution.providerId, timestamp)).toThrow('invalid response');
  });
  it('does not infer a Wikidata entity from a similar name or a brand reference', () => {
    expect(place('no-wiki', { wiki_and_media: undefined, brand_details: { wikidata: 'Q10285' } }).place.references.wikidataId).toBeUndefined();
    expect(place('ambiguous-wiki', { wiki_and_media: { wikidata: 'Q10285;Q99309' } }).place.references.wikidataId).toBeUndefined();
  });
  it('returns destination choices rather than silently selecting a city', () => {
    const matches = normalizeDestinations(collection(feature('rome'), feature('another-rome', { formatted: 'Rome, USA' }), { properties: { lat: NaN } }), 'Rome', timestamp);
    expect(matches).toHaveLength(2); expect(matches[0]!.destinationLabel).toBe('Rome');
  });
  it('centrally translates documented provider categories and selected interests', () => {
    expect(translateCategories(['catering.cafe', 'leisure.park.garden', 'entertainment.museum'])).toEqual(['culture', 'food', 'museums', 'nature', 'relaxation']);
    expect(categoriesForInterests(['history', 'food'])).toEqual(['catering.cafe', 'catering.restaurant', 'tourism.sights']);
  });
});
describe('Geoapify endpoint requests', () => {
  it('sends bounded city geocoding and circle/name/category searches', async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => response(collection(feature())));
    const provider = new GeoapifyPlacesProvider('unit-test-key', new RequestClient(fetcher));
    await provider.resolve('Rome'); await provider.search({ destination: resolution, categories: ['entertainment.museum'], name: 'Museum', radiusKm: 10 });
    const geocode = new URL(fetcher.mock.calls[0]![0] as string); const search = new URL(fetcher.mock.calls[1]![0] as string);
    expect(geocode.pathname).toBe('/v1/geocode/search'); expect(geocode.searchParams.get('type')).toBe('city'); expect(geocode.searchParams.get('limit')).toBe('5');
    expect(search.searchParams.get('filter')).toBe('circle:12.49,41.89,10000'); expect(search.searchParams.get('name')).toBe('Museum'); expect(search.searchParams.get('limit')).toBe('30');
  });
  it('does not send requests when the key is missing or radius is unbounded', async () => {
    const fetcher = vi.fn<typeof fetch>();
    await expect(new GeoapifyPlacesProvider('', new RequestClient(fetcher)).resolve('Rome')).rejects.toMatchObject({ code: 'configuration' });
    await expect(new GeoapifyPlacesProvider('test', new RequestClient(fetcher)).search({ destination: resolution, categories: ['tourism.sights'], name: '', radiusKm: 100 })).rejects.toThrow('radius');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('loads details by provider ID, retaining metadata without parsing raw opening hours', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response(collection(feature(undefined, { feature_type: 'details', opening_hours: 'Mo-Fr 09:00-17:00', contact: { website: 'https://example.org' }, wiki_and_media: { wikidata: 'Q10285' } }))));
    const result = await new GeoapifyPlacesProvider('test', new RequestClient(fetcher)).details(place());
    const url = new URL(fetcher.mock.calls[0]![0] as string); expect(url.pathname).toBe('/v2/place-details'); expect(url.searchParams.get('features')).toBe('details');
    expect(result.place.openingHoursRaw).toBe('Mo-Fr 09:00-17:00'); expect(result.openingWindows).toBeUndefined();
  });
  it('rejects mismatched details identity', async () => {
    const provider = new GeoapifyPlacesProvider('test', new RequestClient(vi.fn<typeof fetch>().mockResolvedValue(response(collection(feature('different', { feature_type: 'details' }))))));
    await expect(provider.details(place())).rejects.toThrow('identity');
  });
  it('feeds normalized real candidates into the existing provider contract and requires resolution', async () => {
    const provider = new GeoapifyPlacesProvider('test', new RequestClient(vi.fn<typeof fetch>().mockResolvedValue(response(collection(feature())))));
    const adapter = new GeoapifyCandidateProvider(provider);
    await expect(adapter.searchCandidates(testTrip)).rejects.toThrow('confirm');
    const result = await adapter.searchCandidates({ ...testTrip, destinationResolution: resolution }); expect(result.dataMode).toBe('live'); expect(result.candidates[0]?.source).toBe('provider');
  });
});
describe('Request limits, cache and errors', () => {
  it.each([401, 403, 429, 500])('reports HTTP %s without leaking request credentials', async (status) => {
    const client = new RequestClient(vi.fn<typeof fetch>().mockResolvedValue(response({}, status)));
    await expect(client.get('https://example.org?apiKey=private')).rejects.toBeInstanceOf(ProviderError);
    try { await client.get('https://example.org/another'); } catch (error) { expect(String(error)).not.toContain('private'); }
  });
  it('deduplicates pending requests and caches bounded responses', async () => {
    let resolve!: (value: Response) => void;
    const fetcher = vi.fn<typeof fetch>().mockImplementation(() => new Promise((done) => { resolve = done; })); const client = new RequestClient(fetcher);
    const first = client.get('https://example.org/data'); const second = client.get('https://example.org/data'); resolve(response({ result: 1 })); await Promise.all([first, second]);
    expect(await client.get('https://example.org/data')).toEqual({ result: 1 }); expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('enforces local quota and server cooldown without automatic retry loops', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response({ result: true })); const client = new RequestClient(fetcher, 1);
    await client.get('https://example.org/one'); await expect(client.get('https://example.org/two')).rejects.toMatchObject({ code: 'rate-limit' }); expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('handles malformed JSON and synchronous network failures without caching failed requests', async () => {
    const client = new RequestClient(vi.fn<typeof fetch>().mockResolvedValue(new Response('broken')));
    await expect(client.get('https://example.org')).rejects.toMatchObject({ code: 'invalid-data' });
    const fetcher = vi.fn<typeof fetch>().mockImplementation(() => { throw new Error('secret URL'); }); const failed = new RequestClient(fetcher);
    await expect(failed.get('https://example.org')).rejects.toMatchObject({ code: 'network' }); await expect(failed.get('https://example.org')).rejects.toThrow('could not be reached'); expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('cancels requests and times out rather than leaving an infinite spinner', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn<typeof fetch>().mockImplementation((_url, options) => new Promise((_resolve, reject) => options?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))));
    const client = new RequestClient(fetcher); const controller = new AbortController(); const canceled = client.get('https://example.org/cancel', controller.signal); const check = expect(canceled).rejects.toMatchObject({ name: 'AbortError' }); controller.abort(); await check;
    const timeout = client.get('https://example.org/timeout'); const timed = expect(timeout).rejects.toMatchObject({ code: 'timeout' }); await vi.advanceTimersByTimeAsync(10_001); await timed;
  });
});
