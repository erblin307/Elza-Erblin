import { z } from 'zod';
import { RequestClient } from '../../../shared/services/requestClient';
import { geoLocationSchema } from '../../../shared/validation/location';
import { travelImageSchema, type TravelImage } from '../domain/travelImage';
import type { Place } from '../../places/domain/normalization';
import { distanceMeters } from '../../../shared/validation/geography';
type MediaPlace = Pick<Place, 'name' | 'location' | 'place'>;

const object = z.record(z.string(), z.unknown());
function plainText(value: unknown) {
  if (typeof value !== 'string' || value.length > 20_000) return '';
  const document = new DOMParser().parseFromString(value, 'text/html');
  document.querySelectorAll('script,style').forEach((entry) => entry.remove());
  return (document.body.textContent ?? '').trim().replace(/\s+/gu, ' ').slice(0, 2000);
}
export function fileForEntity(raw: unknown, entityId: string, place: MediaPlace, toleranceMeters = 2000): string | null {
  const entities = object.safeParse(object.safeParse(raw).data?.entities).data;
  const entity = object.safeParse(entities?.[entityId]).data;
  if (!entity || entity.id !== entityId) return null;
  const claims = object.safeParse(entity.claims).data;
  const coordinates = Array.isArray(claims?.P625) ? claims.P625 : [];
  const matched = coordinates.some((statement) => {
    const claim = object.safeParse(statement).data;
    if (claim?.rank === 'deprecated') return false;
    const value = object.safeParse(object.safeParse(object.safeParse(claim?.mainsnak).data?.datavalue).data?.value).data;
    const point = geoLocationSchema.safeParse(value);
    return point.success && value?.globe === 'http://www.wikidata.org/entity/Q2' && distanceMeters(place.location, point.data) <= toleranceMeters;
  });
  if (!matched) return null;
  const images = Array.isArray(claims?.P18) ? claims.P18.map((entry) => object.safeParse(entry).data).filter((entry) => entry && entry.rank !== 'deprecated') : [];
  const preferred = images.filter((entry) => entry?.rank === 'preferred');
  const selected = preferred.length ? preferred : images;
  const files = [...new Set(selected.flatMap((claim) => {
    const value = object.safeParse(object.safeParse(claim?.mainsnak).data?.datavalue).data?.value;
    return typeof value === 'string' && value.trim() && value.length < 450 ? [value.trim()] : [];
  }))];
  return files.length ? `File:${files.sort()[0]}` : null;
}
export function normalizeCommonsImage(raw: unknown, fileTitle: string, entityId: string, name: string): TravelImage | null {
  const query = object.safeParse(object.safeParse(raw).data?.query).data;
  const pages = object.safeParse(query?.pages).data;
  if (!pages) return null;
  const matching = Object.values(pages).map((entry) => object.safeParse(entry).data).filter((entry) => typeof entry?.title === 'string' && entry.title.replace(/_/gu, ' ') === fileTitle.replace(/_/gu, ' ') && !('missing' in entry));
  if (matching.length !== 1) return null;
  const information = matching[0]?.imageinfo;
  const info = object.safeParse(Array.isArray(information) ? information[0] : undefined).data;
  if (!info || !['image/jpeg', 'image/png', 'image/webp'].includes(String(info.mime))) return null;
  const metadata = object.safeParse(info.extmetadata).data ?? {};
  const text = (key: string) => plainText(object.safeParse(metadata[key]).data?.value);
  if (text('Restrictions')) return null;
  const licenseUrl = text('LicenseUrl').replace(/^http:\/\//u, 'https://');
  const result = travelImageSchema.safeParse({ url: info.thumburl, alt: `${name} — image linked to Wikidata ${entityId}`, source: 'wikimedia', entityId, fileTitle,
    attribution: { author: text('Artist'), credit: text('Credit') || undefined, license: text('LicenseShortName'), licenseUrl, sourceUrl: info.descriptionurl } });
  return result.success ? result.data : null;
}
export class WikimediaMediaService {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private client = new RequestClient(undefined, 20, { 'Api-User-Agent': `SmartTravelPlanner/0.1 (${import.meta.env.VITE_WIKIMEDIA_CONTACT || (typeof window !== 'undefined' ? window.location.origin : 'local development')})` })) {}
  resolve(place: MediaPlace, signal?: AbortSignal, toleranceMeters = 2000): Promise<TravelImage | null> {
    const task = this.queue.then(async () => {
      const entityId = place.place.references.wikidataId;
      if (!entityId || !/^Q[1-9]\d*$/u.test(entityId)) return null;
      try {
        signal?.throwIfAborted();
        const wikidata = new URL('https://www.wikidata.org/w/api.php');
        wikidata.search = new URLSearchParams({ action: 'wbgetentities', ids: entityId, props: 'claims', format: 'json', origin: '*' }).toString();
        const file = fileForEntity(await this.client.get(wikidata.href, signal), entityId, place, toleranceMeters);
        if (!file) return null;
        const commons = new URL('https://commons.wikimedia.org/w/api.php');
        commons.search = new URLSearchParams({ action: 'query', prop: 'imageinfo', titles: file, iiprop: 'url|extmetadata|mime', iiurlwidth: '480', format: 'json', origin: '*' }).toString();
        return normalizeCommonsImage(await this.client.get(commons.href, signal), file, entityId, place.name);
      } catch { signal?.throwIfAborted(); return null; }
    });
    this.queue = task.catch(() => null); return task;
  }
}
export const wikimediaMediaService = new WikimediaMediaService();
