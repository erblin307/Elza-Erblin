import type { ActivityCandidate, ItineraryItem, PlanningContext } from '../types/itinerary';

export function activityCost(candidate: ActivityCandidate, context: Pick<PlanningContext, 'travelers' | 'currency'>): { amount?: number; reason?: string } {
  const price = candidate.price;
  if (!price) return { reason: 'Cost unknown' };
  if (price.currency !== context.currency) return { reason: `Price in ${price.currency}; no currency conversion available` };
  if (price.unit === 'entry' && price.entriesRequired === undefined) return { reason: 'Entry quantity unknown' };
  const multiplier = price.unit === 'person' ? context.travelers : price.unit === 'entry' ? price.entriesRequired! : 1;
  const amount = Math.round(price.amount * multiplier * 100) / 100;
  return Number.isFinite(amount) ? { amount } : { reason: 'Cost exceeds supported numeric range' };
}

export function costSummary(items: ItineraryItem[], catalog: ActivityCandidate[], context: Pick<PlanningContext, 'travelers' | 'currency'>) {
  const candidates = new Map(catalog.map((candidate) => [candidate.id, candidate]));
  let knownCost = 0;
  let unknownCount = 0;
  for (const item of items) {
    const candidate = candidates.get(item.activityId);
    const cost = candidate ? activityCost(candidate, context) : {};
    if (cost.amount === undefined) unknownCount++;
    else knownCost += cost.amount;
  }
  return { knownCost: Math.round(knownCost * 100) / 100, unknownCount };
}

export function formatMoney(amount: number, currency: PlanningContext['currency']) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);
}
