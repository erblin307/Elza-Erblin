import { z } from 'zod';
import { supportedCurrencies } from '../types/trip';

const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;

function isRealDateOnly(value: string) {
  if (!dateOnlyPattern.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month! - 1 && date.getUTCDate() === day;
}

export const createTripSchema = z
  .object({
    origin: z.string().trim().min(1, 'Enter where you are starting from.').max(120, 'Keep the origin under 120 characters.'),
    destination: z.string().trim().min(1, 'Enter where you are going.').max(120, 'Keep the destination under 120 characters.'),
    startDate: z.string().refine(isRealDateOnly, 'Choose a valid start date.'),
    endDate: z.string().refine(isRealDateOnly, 'Choose a valid end date.'),
    travelers: z.coerce.number().int('Use a whole number.').min(1, 'Add at least one traveler.').max(99, 'Enter 99 travelers or fewer.'),
    budget: z.object({
      amount: z.coerce.number().finite('Enter a valid budget.').positive('Budget must be greater than zero.'),
      currency: z.enum(supportedCurrencies, { message: 'Choose a supported currency.' }),
    }),
  })
  .superRefine((value, context) => {
    if (isRealDateOnly(value.startDate) && isRealDateOnly(value.endDate) && value.endDate < value.startDate) {
      context.addIssue({
        code: 'custom',
        path: ['endDate'],
        message: 'End date must be on or after the start date.',
      });
    }
  });

export type TripFormValues = z.input<typeof createTripSchema>;
