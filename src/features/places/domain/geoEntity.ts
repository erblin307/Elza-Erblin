import { z } from 'zod';
import { geoLocationSchema, safeExternalUrl } from '../../../shared/validation/location';
import { placeMetadataSchema } from './placeMetadata';

export const geoEntitySchema = z.object({
  id: z.string().regex(/^geoapify-[a-zA-Z0-9_-]{1,512}$/u),
  providerId: z.string().regex(/^[a-zA-Z0-9_-]{1,512}$/u),
  name: z.string().trim().min(1).max(500), location: geoLocationSchema,
  description: z.string().max(2000).optional(), place: placeMetadataSchema,
}).refine((entity) => entity.id === `geoapify-${entity.providerId}` && entity.place.provider === 'geoapify', { message: 'Provider identity mismatch.' })
  .refine((entity) => !entity.place.image || entity.place.image.entityId === entity.place.references.wikidataId, { message: 'Photo identity mismatch.' });
export type GeoEntity = z.infer<typeof geoEntitySchema>;
export const geoFields = z.record(z.string(), z.unknown());
export function optionalText(value: unknown, maximum = 1000): string | undefined { return typeof value === 'string' && value.trim() && value.trim().length <= maximum ? value.trim() : undefined; }
export function normalizeGeoEntity(p: Record<string, unknown>, destinationId: string, now: string) {
  const categories = Array.isArray(p.categories) ? p.categories.filter((value): value is string => typeof value === 'string' && value.length <= 150) : [];
  const wiki = geoFields.safeParse(p.wiki_and_media).data ?? {};
  const raw = geoFields.safeParse(geoFields.safeParse(p.datasource).data?.raw).data ?? {};
  const contact = geoFields.safeParse(p.contact).data ?? {};
  const website = safeExternalUrl.safeParse(p.website ?? contact.website ?? raw.website);
  const wikidata = z.string().regex(/^Q[1-9]\d*$/u).safeParse(wiki.wikidata ?? raw.wikidata);
  return geoEntitySchema.safeParse({
    id: `geoapify-${String(p.place_id)}`, providerId: p.place_id, name: p.name, location: { latitude: p.lat, longitude: p.lon }, description: optionalText(p.description, 2000),
    place: { provider: 'geoapify', destinationId, providerCategories: categories, address: optionalText(p.formatted), website: website.success ? website.data : undefined,
      references: { wikidataId: wikidata.success ? wikidata.data : undefined, osmId: optionalText(raw.osm_id, 200) ?? (typeof raw.osm_id === 'number' ? String(raw.osm_id) : undefined) },
      openingHoursRaw: optionalText(p.opening_hours ?? raw.opening_hours, 2000), attribution: 'Powered by Geoapify · © OpenStreetMap contributors (ODbL)', fetchedAt: now },
  });
}
