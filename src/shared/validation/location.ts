import { z } from 'zod';

export const geoLocationSchema = z.object({ latitude: z.number().finite().min(-90).max(90), longitude: z.number().finite().min(-180).max(180) });
export const safeExternalUrl = z.string().max(2000).refine((value) => {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password; } catch { return false; }
}, 'Invalid external URL.');
export function canonicalDestination(value: string) { return value.normalize('NFC').trim().replace(/\s+/gu, ' ').toLowerCase(); }
