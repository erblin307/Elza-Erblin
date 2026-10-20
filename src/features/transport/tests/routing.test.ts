import { describe, expect, it, vi } from 'vitest';
import { geoJSONPoint, leafletLines, normalizeRoute, routeKey, waypoint } from '../domain/routing';
import { GeoapifyRoutingProvider } from '../services/routingProvider';
import { GeoapifyPlacesProvider } from '../../places/services/geoapifyProvider';
import { RequestClient } from '../../../shared/services/requestClient';
import { request, routeResponse } from './testData';
const now = '2026-10-14T12:00:00.000Z';
describe('Routing provider normalization', () => {
  it('converts request, GeoJSON and Leaflet coordinate orders centrally', () => {
    expect(waypoint(request.points[0]!)).toBe('41.89,12.49'); expect(geoJSONPoint([12.49,41.89])).toEqual(request.points[0]);
    expect(leafletLines(normalizeRoute(routeResponse(), request, now).geometry)[0]![0]).toEqual([41.89,12.49]);
  });
  it.each(['walk','drive','bicycle'] as const)('normalizes %s without estimating values locally', (mode) => {
    const input = { ...request, mode }; const route = normalizeRoute(routeResponse(input),input,now);
    expect(route.distanceMeters).toBe(1500); expect(route.estimatedDurationSeconds).toBe(2400); expect(route.request.mode).toBe(mode); expect(route.source).toBe('provider');
  });
  it.each(['geometry','negative-distance','negative-time','coordinates','mode','legs','totals','empty','far-away'])('rejects malformed %s', (kind) => {
    const raw = routeResponse(); const feature = raw.features[0]!;
    if(kind==='geometry') feature.geometry.type='Polygon';
    if(kind==='negative-distance') feature.properties.distance=-1;
    if(kind==='negative-time') feature.properties.time=-1;
    if(kind==='coordinates') feature.geometry.coordinates[0]![0]=[190,95];
    if(kind==='mode') feature.properties.mode='drive';
    if(kind==='legs') feature.properties.legs=[];
    if(kind==='totals') feature.properties.legs[0]!.time=0;
    if(kind==='empty') raw.features=[];
    if(kind==='far-away') feature.geometry.coordinates[0]![0]=[0,0];
    expect(() => normalizeRoute(raw,request,now)).toThrow();
  });
  it('supports LineString and ordered multiple legs', () => {
    const raw=routeResponse(); const feature=raw.features[0]!;
    expect(normalizeRoute({ ...raw, features:[{...feature,geometry:{type:'LineString',coordinates:feature.geometry.coordinates[0]}}]},request,now).geometry.type).toBe('LineString');
    const input={...request,points:[...request.points,{latitude:41.91,longitude:12.47}]};
    expect(normalizeRoute(routeResponse(input),input,now).legs).toHaveLength(2);
  });
  it('keys geometry by direction, ordered points and mode', () => {
    expect(routeKey(request)).not.toBe(routeKey({...request,mode:'drive'}));
    expect(routeKey(request)).not.toBe(routeKey({...request,points:[...request.points].reverse()}));
  });
  it('uses the existing client and documented endpoint with bounded caching', async () => {
    const fetcher=vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(routeResponse())));
    const provider=new GeoapifyRoutingProvider(new GeoapifyPlacesProvider('unit-test',new RequestClient(fetcher)));
    await provider.getRoute(request); await provider.getRoute(request);
    expect(fetcher).toHaveBeenCalledTimes(1); const url=new URL(String(fetcher.mock.calls[0]![0]));
    expect(url.pathname).toBe('/v1/routing'); expect(url.searchParams.get('waypoints')).toBe('41.89,12.49|41.9,12.48'); expect(url.searchParams.get('optimize_stops')).toBe('false'); expect(url.searchParams.get('traffic')).toBe('free_flow');
  });
  it.each([401,429,500])('handles HTTP %s without exposing credentials', async (status) => {
    const provider=new GeoapifyRoutingProvider(new GeoapifyPlacesProvider('secret-test',new RequestClient(vi.fn().mockResolvedValue(new Response('{}',{status})))));
    await expect(provider.getRoute(request)).rejects.not.toThrow('secret-test');
  });
  it('rejects missing keys, invalid input, malformed JSON and aborted requests', async () => {
    await expect(new GeoapifyRoutingProvider(new GeoapifyPlacesProvider('')).getRoute(request)).rejects.toThrow('configuration');
    const fetcher=vi.fn<typeof fetch>().mockResolvedValue(new Response('invalid-json')); const provider=new GeoapifyRoutingProvider(new GeoapifyPlacesProvider('test',new RequestClient(fetcher)));
    await expect(provider.getRoute({...request,points:[{latitude:100,longitude:0},request.points[1]!]})).rejects.toThrow(); expect(fetcher).not.toHaveBeenCalled();
    await expect(provider.getRoute(request)).rejects.toThrow('malformed JSON');
    const controller=new AbortController();controller.abort();await expect(provider.getRoute(request,controller.signal)).rejects.toThrow();
  });
  it('times out a routing request through shared request controls', async () => {
    vi.useFakeTimers();
    try {
      const fetcher=vi.fn<typeof fetch>().mockImplementation((_url,options)=>new Promise((_resolve,reject)=>options?.signal?.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')))));
      const provider=new GeoapifyRoutingProvider(new GeoapifyPlacesProvider('test',new RequestClient(fetcher)));
      const assertion=expect(provider.getRoute(request)).rejects.toThrow('timed out');await vi.advanceTimersByTimeAsync(10001);await assertion;
    } finally {vi.useRealTimers();}
  });
  it('expires normalized and raw caches and retrieves fresh metrics', async () => {
    vi.useFakeTimers();
    try {
      const fetcher=vi.fn<typeof fetch>().mockImplementation(async()=>new Response(JSON.stringify(routeResponse())));
      const provider=new GeoapifyRoutingProvider(new GeoapifyPlacesProvider('test',new RequestClient(fetcher)));await provider.getRoute(request);await vi.advanceTimersByTimeAsync(300001);await provider.getRoute(request);expect(fetcher).toHaveBeenCalledTimes(2);
    } finally {vi.useRealTimers();}
  });
});
