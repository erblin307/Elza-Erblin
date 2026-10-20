import { preferenceLabel } from '../../trips/utils/tripFormatters';
import { activityCost } from './costs';
import type { ActivityCandidate, PlanningConfig, PlanningContext } from '../types/itinerary';

export function scoreActivity(candidate: ActivityCandidate, context: PlanningContext, config: PlanningConfig, coveredCategories: Set<string> = new Set()) {
  const matched = candidate.categories.filter((category) => context.interests.includes(category));
  const diversityCategories = context.interests.length ? matched : candidate.categories;
  const cost = activityCost(candidate, context);
  const factors = {
    interest: context.interests.length ? config.weights.interest * matched.length / candidate.categories.length : 0,
    diversity: diversityCategories.length ? config.weights.diversity * diversityCategories.filter((category) => !coveredCategories.has(category)).length / diversityCategories.length : 0,
    budget: cost.amount !== undefined && cost.amount <= config.activityAllowance ? config.weights.budget * (config.activityAllowance === 0 ? 1 : 1 - cost.amount / config.activityAllowance) : 0,
    duration: candidate.durationMinutes !== undefined ? config.weights.duration * Math.max(0, 1 - candidate.durationMinutes / 480) : 0,
    quality: candidate.source === 'provider' && candidate.rating !== undefined ? config.weights.quality * candidate.rating / 5 : 0,
  };
  const reasons: string[] = [];
  if (matched.length) reasons.push(`Matches your interest in ${matched.map(preferenceLabel).join(', ')}.`);
  if (factors.diversity > 0) reasons.push('Adds category variety to this plan.');
  if (cost.amount !== undefined && cost.amount <= config.activityAllowance) reasons.push('Known estimated cost fits the activity allowance at selection time.');
  if (candidate.durationMinutes !== undefined) reasons.push('Duration supplied by the candidate source.');
  if (!reasons.length) reasons.push('Selected from the available destination candidate pool.');
  return { score: Object.values(factors).reduce((total, value) => total + value, 0), factors, reasons };
}

export function rankCandidates(candidates: ActivityCandidate[], context: PlanningContext, config: PlanningConfig, coveredCategories: Set<string> = new Set()) {
  return candidates.map((candidate) => ({ candidate, ...scoreActivity(candidate, context, config, coveredCategories) }))
    .sort((a, b) => b.score - a.score || (a.candidate.id < b.candidate.id ? -1 : a.candidate.id > b.candidate.id ? 1 : 0));
}
