import { z } from 'zod';
import { safeExternalUrl } from '../../../shared/validation/location';

export const travelImageSchema = z.object({
  url: safeExternalUrl.refine((value) => new URL(value).protocol === 'https:' && new URL(value).hostname === 'upload.wikimedia.org'),
  alt: z.string().min(1).max(500), source: z.literal('wikimedia'), entityId: z.string().regex(/^Q[1-9]\d*$/u), fileTitle: z.string().min(1).max(500),
  attribution: z.object({ author: z.string().min(1).max(2000), credit: z.string().max(2000).optional(), license: z.string().min(1).max(100),
    licenseUrl: safeExternalUrl.refine((value) => /^https:\/\/creativecommons\.org\/(licenses\/(by|by-sa)\/(1\.0|2\.0|2\.5|3\.0|4\.0)|publicdomain\/(zero|mark)\/1\.0)\/?$/u.test(value)),
    sourceUrl: safeExternalUrl.refine((value) => new URL(value).protocol === 'https:' && new URL(value).hostname === 'commons.wikimedia.org' && new URL(value).pathname.startsWith('/wiki/File:')) }),
});
export type TravelImage = z.infer<typeof travelImageSchema>;
