import { z } from 'zod';
import type { Trip } from '../../trips/types/trip';
import { supportedCurrencies } from '../../trips/types/trip';
import { isRealDateOnly } from '../../trips/validation/tripSchema';

export const expenseCategories = ['accommodation', 'transportation', 'activities', 'food', 'shopping', 'other'] as const;
export type ExpenseCategory = (typeof expenseCategories)[number];

export const expenseCategoryLabels: Record<ExpenseCategory, string> = {
  accommodation: 'Accommodation',
  transportation: 'Transportation',
  activities: 'Activities',
  food: 'Food',
  shopping: 'Shopping',
  other: 'Other',
};

export const manualExpenseInputSchema = z.object({
  title: z.string().trim().min(1, 'Enter an expense title.').max(120, 'Keep the title under 120 characters.'),
  amount: z.coerce.number().finite('Enter a valid amount.').positive('Amount must be greater than zero.').max(1_000_000_000, 'Amount is too large.'),
  category: z.enum(expenseCategories),
  certainty: z.enum(['confirmed', 'estimated']),
  date: z.string().refine((value) => value === '' || isRealDateOnly(value), 'Choose a valid date.').transform((value) => value || undefined).optional(),
  note: z.string().trim().max(500, 'Keep the note under 500 characters.').transform((value) => value || undefined).optional(),
});

const expenseIdSchema = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,199}$/u);

export const manualExpenseSchema = manualExpenseInputSchema.extend({
  id: expenseIdSchema,
  tripId: expenseIdSchema,
  currency: z.enum(supportedCurrencies),
  source: z.literal('manual'),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const budgetLedgerSchema = z.object({
  version: z.literal(1),
  expenses: z.array(manualExpenseSchema).max(500),
}).superRefine((ledger, context) => {
  const ids = new Set<string>();
  for (const expense of ledger.expenses) {
    if (ids.has(expense.id)) context.addIssue({ code: 'custom', path: ['expenses'], message: 'Duplicate expense IDs.' });
    ids.add(expense.id);
  }
});

export type ManualExpenseInput = z.input<typeof manualExpenseInputSchema>;
export type ManualExpense = z.infer<typeof manualExpenseSchema>;
export type BudgetLedger = z.infer<typeof budgetLedgerSchema>;

export const emptyBudgetLedger = (): BudgetLedger => ({ version: 1, expenses: [] });

export function createManualExpense(trip: Trip, input: ManualExpenseInput, id: string, now: string): ManualExpense {
  const values = manualExpenseInputSchema.parse(input);
  return manualExpenseSchema.parse({ ...values, id, tripId: trip.id, currency: trip.budget.currency, source: 'manual', createdAt: now, updatedAt: now });
}

export function updateManualExpense(expense: ManualExpense, input: ManualExpenseInput, currency: Trip['budget']['currency'], now: string): ManualExpense {
  const values = manualExpenseInputSchema.parse(input);
  return manualExpenseSchema.parse({ ...expense, ...values, currency, updatedAt: now });
}
