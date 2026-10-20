import { z } from 'zod';
import { geoLocationSchema } from '../../../shared/validation/location';

export const destinationResolutionSchema = z.object({
  provider: z.enum(['geoapify', 'fixture']), providerId: z.string().min(1).max(512),
  destinationLabel: z.string().min(1).max(500), formatted: z.string().min(1).max(500),
  location: geoLocationSchema, resolvedAt: z.iso.datetime(),
});
export type DestinationResolution = z.infer<typeof destinationResolutionSchema>;
