import type { Trip } from '../../trips/types/trip';
import type { Currency } from '../../trips/types/trip';
import { activityCost } from '../../itinerary/domain/costs';
import { planningContext } from '../../itinerary/domain/context';
import { calendarDates } from '../../itinerary/domain/scheduling';
import { accommodationCost } from '../../accommodation/services/inventoryProvider';
import { expenseCategories, expenseCategoryLabels, type ExpenseCategory, type ManualExpense } from './model';
import { eventDate, journeyExpired, journeyNeedsReview } from '../../long-distance-transport/domain/model';

export type BudgetExpense = {
  id: string;
  tripId: string;
  category: ExpenseCategory;
  title: string;
  amount: number;
  currency: Currency;
  date?: string;
  source: 'manual' | 'itinerary' | 'long_distance';
  sourceId: string;
  certainty: 'confirmed' | 'estimated';
  note?: string;
};

export type CostCoverage = {
  source: 'accommodation' | 'activities' | 'transportation';
  status: 'included' | 'partial' | 'unavailable' | 'not-planned';
  label: string;
  detail: string;
};

export type BudgetStatus = 'comfortable' | 'close' | 'over';

export type BudgetSnapshot = {
  expenses: BudgetExpense[];
  coverage: CostCoverage[];
  categoryTotals: Record<ExpenseCategory, number>;
  dailyTotals: { date: string; total: number; categories: Record<ExpenseCategory, number> }[];
  total: number;
  confirmedTotal: number;
  estimatedTotal: number;
  remaining: number;
  overBy: number;
  usagePercent: number;
  status: BudgetStatus;
  unknownSourceCount: number;
  unallocatedExpenseCount: number;
  insights: string[];
};

function cents(value: number) {
  return Number.isFinite(value) ? Math.round(value * 100) : 0;
}

function amount(value: number) {
  return Math.round(value) / 100;
}

function itineraryExpenses(trip: Trip) {
  const expenses: BudgetExpense[] = [];
  let totalItems = 0;
  let unknownItems = 0;
  const itinerary = trip.itinerary;
  if (!itinerary) return { expenses, totalItems, unknownItems, stale: false };
  totalItems = itinerary.days.reduce((sum, day) => sum + day.items.length, 0);
  const current = planningContext(trip);
  const incompatible = itinerary.context.destination !== current.destination || itinerary.context.startDate !== current.startDate || itinerary.context.endDate !== current.endDate || itinerary.context.destinationId !== current.destinationId;
  if (incompatible) return { expenses, totalItems, unknownItems: totalItems, stale: true };
  const candidates = new Map(itinerary.catalog.map((candidate) => [candidate.id, candidate]));
  const seen = new Set<string>();
  for (const day of itinerary.days) for (const item of day.items) {
    const candidate = candidates.get(item.activityId);
    const cost = candidate ? activityCost(candidate, { travelers: trip.travelers, currency: trip.budget.currency }) : {};
    if (!candidate || cost.amount === undefined) { unknownItems++; continue; }
    const sourceId = item.id;
    if (seen.has(sourceId)) continue;
    seen.add(sourceId);
    expenses.push({
      id: `itinerary-${sourceId}`,
      tripId: trip.id,
      category: 'activities',
      title: candidate.name,
      amount: cost.amount,
      currency: trip.budget.currency,
      date: day.date,
      source: 'itinerary',
      sourceId,
      certainty: 'estimated',
      note: candidate.price?.basis === 'sample_estimate' ? 'Demonstration estimate from the itinerary source.' : 'Source estimate from the itinerary.',
    });
  }
  return { expenses, totalItems, unknownItems, stale: false };
}

function manualExpenses(trip: Trip) {
  const expenses: BudgetExpense[] = [];
  let nonComparable = 0;
  for (const entry of trip.budgetLedger?.expenses ?? []) {
    if (entry.tripId !== trip.id || entry.currency !== trip.budget.currency) { nonComparable++; continue; }
    expenses.push({ ...entry, sourceId: entry.id });
  }
  return { expenses, nonComparable };
}

function longDistanceExpenses(trip: Trip) {
  const expenses: BudgetExpense[] = []; let unknown = 0; const seen = new Set<string>();
  const manualIds = new Set(trip.budgetLedger?.expenses.map((expense) => expense.id) ?? []);
  for (const journey of trip.longDistanceTravel?.journeys ?? []) {
    const cost = journey.cost;
    if (!cost || journeyNeedsReview(trip, journey) || journeyExpired(journey)) { unknown++; continue; }
    if (cost.reconciledExpenseId && manualIds.has(cost.reconciledExpenseId)) continue;
    if (seen.has(cost.identity)) continue;
    seen.add(cost.identity);
    if (cost.currency !== trip.budget.currency) { unknown++; continue; }
    expenses.push({ id: `travel-${cost.identity}`, tripId: trip.id, category: 'transportation', title: journey.mode === 'flight' ? 'Planned flight offer' : `Planned ${journey.mode} journey`, amount: cost.amount, currency: trip.budget.currency, date: eventDate(journey.departure), source: 'long_distance', sourceId: cost.identity, certainty: 'estimated', note: cost.provenance === 'provider_offer' ? `${cost.scope === 'round_trip' ? 'Round-trip total' : 'Offer total'} from ${journey.provider ?? 'flight provider'}; planned, not booked.` : 'User-estimated long-distance travel cost.' });
  }
  return { expenses, unknown, planned: Boolean(trip.longDistanceTravel?.journeys.length) };
}

function statusFor(total: number, budget: number): BudgetStatus {
  if (budget <= 0) return total > 0 ? 'over' : 'comfortable';
  if (total > budget) return 'over';
  return total / budget >= 0.8 ? 'close' : 'comfortable';
}

function transportPlanned(trip: Trip) {
  return Boolean(trip.itinerary?.days.some((day) => day.items.length > 1 || (day.items.length > 0 && (trip.transportSettings?.hotelOrigin || trip.transportSettings?.hotelReturn))));
}

export function calculateBudget(trip: Trip): BudgetSnapshot {
  const itinerary = itineraryExpenses(trip);
  const manual = manualExpenses(trip);
  const longDistance = longDistanceExpenses(trip);
  const expenses = [...itinerary.expenses, ...longDistance.expenses, ...manual.expenses];
  const categoryCents = Object.fromEntries(expenseCategories.map((category) => [category, 0])) as Record<ExpenseCategory, number>;
  let totalCents = 0; let confirmedCents = 0; let estimatedCents = 0;
  for (const expense of expenses) {
    const value = cents(expense.amount);
    categoryCents[expense.category] += value; totalCents += value;
    if (expense.certainty === 'confirmed') confirmedCents += value; else estimatedCents += value;
  }
  const categoryTotals = Object.fromEntries(expenseCategories.map((category) => [category, amount(categoryCents[category])])) as Record<ExpenseCategory, number>;
  const days = calendarDates(trip.startDate, trip.endDate);
  const dailyTotals = days.map((date) => {
    const categoryDayCents = Object.fromEntries(expenseCategories.map((category) => [category, 0])) as Record<ExpenseCategory, number>;
    for (const expense of expenses) if (expense.date === date) categoryDayCents[expense.category] += cents(expense.amount);
    const categories = Object.fromEntries(expenseCategories.map((category) => [category, amount(categoryDayCents[category])])) as Record<ExpenseCategory, number>;
    return { date, categories, total: amount(expenseCategories.reduce((sum, category) => sum + categoryDayCents[category], 0)) };
  });
  const daySet = new Set(days);
  const unallocatedExpenseCount = expenses.filter((expense) => !expense.date || !daySet.has(expense.date)).length;
  const total = amount(totalCents);
  const budgetCents = cents(trip.budget.amount);
  const remainingCents = budgetCents - totalCents;
  const usagePercent = budgetCents > 0 ? Math.round(totalCents / budgetCents * 1000) / 10 : 0;
  const status = statusFor(totalCents, budgetCents);
  const accommodation = accommodationCost(trip.selectedStay);
  const coverage: CostCoverage[] = [
    trip.selectedStay
      ? { source: 'accommodation', status: 'unavailable', label: 'Accommodation', detail: accommodation.reason }
      : { source: 'accommodation', status: 'not-planned', label: 'Accommodation', detail: 'No selected stay cost is available.' },
    itinerary.stale
      ? { source: 'activities', status: 'unavailable', label: 'Activities', detail: 'The preserved itinerary is outdated for current Trip details. Regenerate it before its source costs can enter this budget.' }
      : itinerary.totalItems === 0
      ? { source: 'activities', status: 'not-planned', label: 'Activities', detail: 'No itinerary activity costs are available.' }
      : itinerary.unknownItems > 0
        ? { source: 'activities', status: itinerary.expenses.length ? 'partial' : 'unavailable', label: 'Activities', detail: `${itinerary.expenses.length} of ${itinerary.totalItems} activity costs are comparable in ${trip.budget.currency}.` }
        : { source: 'activities', status: 'included', label: 'Activities', detail: `All ${itinerary.totalItems} itinerary activity costs are included as estimates.` },
    longDistance.planned && longDistance.expenses.length
      ? { source: 'transportation', status: longDistance.unknown || transportPlanned(trip) ? 'partial' : 'included', label: 'Transportation', detail: `${longDistance.expenses.length} current long-distance cost ${longDistance.expenses.length === 1 ? 'identity is' : 'identities are'} included once. Local route fares remain unknown.` }
      : longDistance.planned
        ? { source: 'transportation', status: 'unavailable', label: 'Transportation', detail: 'Planned long-distance prices are unknown, expired, outdated or use another currency. Local route fares remain unknown.' }
      : transportPlanned(trip)
      ? { source: 'transportation', status: 'unavailable', label: 'Transportation', detail: 'Routes provide distance and duration, not fares, fuel, parking or toll costs.' }
      : { source: 'transportation', status: 'not-planned', label: 'Transportation', detail: 'No priced transportation source is attached.' },
  ];
  const unknownSourceCount = itinerary.unknownItems + manual.nonComparable + longDistance.unknown + (trip.selectedStay ? 1 : 0) + (transportPlanned(trip) ? 1 : 0);
  const insights: string[] = [];
  if (status === 'over') insights.push(`The known plan exceeds the trip budget by ${formatMoney(amount(-remainingCents), trip.budget.currency)}.`);
  else insights.push(`${formatMoney(amount(remainingCents), trip.budget.currency)} remains after currently known costs.`);
  const largestCategory = expenseCategories.map((category) => ({ category, value: categoryTotals[category] })).sort((a, b) => b.value - a.value || a.category.localeCompare(b.category))[0];
  if (largestCategory && largestCategory.value > 0) insights.push(`${expenseCategoryLabels[largestCategory.category]} is the largest known category at ${formatMoney(largestCategory.value, trip.budget.currency)}.`);
  const largestDay = dailyTotals.slice().sort((a, b) => b.total - a.total || a.date.localeCompare(b.date))[0];
  if (largestDay && largestDay.total > 0) insights.push(`${formatDateLabel(largestDay.date)} is the most expensive dated day at ${formatMoney(largestDay.total, trip.budget.currency)}.`);
  if (unknownSourceCount > 0) insights.push('Some source costs are unknown or use another currency, so the known total is incomplete.');
  return {
    expenses, coverage, categoryTotals, dailyTotals, total,
    confirmedTotal: amount(confirmedCents), estimatedTotal: amount(estimatedCents),
    remaining: amount(Math.max(remainingCents, 0)), overBy: amount(Math.max(-remainingCents, 0)),
    usagePercent, status, unknownSourceCount, unallocatedExpenseCount, insights,
  };
}

export function formatMoney(value: number, currency: Currency) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
}

export function formatDateLabel(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(year!, month! - 1, day));
}

export function statusLabel(status: BudgetStatus) {
  return status === 'comfortable' ? 'Comfortable' : status === 'close' ? 'Close to limit' : 'Over budget';
}

export function ledgerWithout(expenses: ManualExpense[], id: string) {
  return { version: 1 as const, expenses: expenses.filter((expense) => expense.id !== id) };
}
