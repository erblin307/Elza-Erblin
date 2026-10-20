import { z } from 'zod';
import { safeExternalUrl } from '../../../shared/validation/location';
import { travelImageSchema } from '../../media/domain/travelImage';

export const placeMetadataSchema = z.object({
  provider: z.enum(['geoapify', 'fixture']), destinationId: z.string().min(1).max(512),
  providerCategories: z.array(z.string().min(1).max(150)).min(1),
  address: z.string().max(1000).optional(), website: safeExternalUrl.optional(),
  references: z.object({ wikidataId: z.string().regex(/^Q[1-9]\d*$/u).optional(), osmId: z.string().max(200).optional() }).default({}),
  openingHoursRaw: z.string().max(2000).optional(),
  attribution: z.string().min(1).max(500), fetchedAt: z.iso.datetime(), image: travelImageSchema.optional(),
});
