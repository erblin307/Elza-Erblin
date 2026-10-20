import type { z } from 'zod';
import type { activityCandidateSchema, itineraryShape, planningConfigSchema, planningContextSchema } from '../domain/validation';

export type ActivityCandidate = z.infer<typeof activityCandidateSchema>;
export type GeneratedItinerary = z.infer<typeof itineraryShape>;
export type ItineraryDay = GeneratedItinerary['days'][number];
export type ItineraryItem = ItineraryDay['items'][number];
export type PlanningContext = z.infer<typeof planningContextSchema>;
export type PlanningConfig = z.infer<typeof planningConfigSchema>;
export type ScoreWeights = PlanningConfig['weights'];
