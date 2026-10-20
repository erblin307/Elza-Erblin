import { z } from 'zod';
import { accommodationOptions, defaultPreferences, interestOptions, paceOptions, supportedCurrencies, transportationOptions } from '../types/trip';
import { isValidTripId } from './tripId';

const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;

export function isRealDateOnly(value: string) {
  if (!dateOnlyPattern.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return false;
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month! - 1 && date.getUTCDate() === day;
}

export function normalizeLocation(value: string) {
  return value.normalize('NFC').trim().replace(/\s+/gu, ' ');
}

export const preferencesSchema = z.object({
  accommodation: z.enum(accommodationOptions).default('any'),
  transportation: z.array(z.enum(transportationOptions)).default([]).transform((values) => transportationOptions.filter((value) => values.includes(value))),
  interests: z.array(z.enum(interestOptions)).default([]).transform((values) => interestOptions.filter((value) => values.includes(value))),
  pace: z.enum(paceOptions).default('balanced'),
  notes: z.string().trim().max(1000, 'Keep notes to 1,000 characters or fewer.').optional().transform((value) => value || undefined),
});

const locationSchema = (name: string) => z.string().transform(normalizeLocation).pipe(z.string()
  .min(1, `Enter your ${name}.`).max(120, `Keep the ${name} under 120 characters.`)
  .refine((value) => /\p{L}/u.test(value), 'Enter a meaningful city or place name.'));

export const tripInputFields = z
  .object({
    origin: locationSchema('origin'),
    destination: locationSchema('destination'),
    startDate: z.string().refine(isRealDateOnly, 'Choose a valid start date.'),
    endDate: z.string().refine(isRealDateOnly, 'Choose a valid end date.'),
    travelers: z.coerce.number().int('Use a whole number.').min(1, 'Add at least one traveler.'),
    budget: z.object({
      amount: z.coerce.number().finite('Enter a valid budget.').positive('Budget must be greater than zero.'),
      currency: z.enum(supportedCurrencies, { message: 'Choose a supported currency.' }),
    }),
    preferences: preferencesSchema.optional(),
  });

export const createTripSchema = tripInputFields.extend({ preferences: preferencesSchema.default(() => ({ ...defaultPreferences(), notes: undefined })) })
  .superRefine((value, context) => {
    if (isRealDateOnly(value.startDate) && isRealDateOnly(value.endDate) && value.endDate < value.startDate) {
      context.addIssue({
        code: 'custom',
        path: ['endDate'],
        message: 'End date must be on or after the start date.',
      });
    }
  });

export const storedTripSchema = tripInputFields.extend({
  // Preserve every location label accepted by Prompt 01; apply stronger rules on the next explicit save.
  origin: z.string().refine((value) => value.trim().length > 0), destination: z.string().refine((value) => value.trim().length > 0),
  travelers: z.number().int().positive(),
  budget: z.object({ amount: z.number().finite().positive(), currency: z.enum(supportedCurrencies) }),
  id: z.string().refine(isValidTripId), title: z.string().refine((value) => value.trim().length > 0),
  createdAt: z.iso.datetime(), updatedAt: z.iso.datetime(),
}).refine((value) => value.endDate >= value.startDate, { path: ['endDate'], message: 'Invalid stored date order.' });
