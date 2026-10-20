import { z } from 'zod';
import { paceOptions } from '../../trips/types/trip';

const id = z.string().min(1).max(600);
export const actionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('remove_activity'), itemId: id }).strict(),
  z.object({ type: z.literal('move_activity'), itemId: id, dayId: id }).strict(),
  z.object({ type: z.literal('reorder_activity'), itemId: id, direction: z.enum(['up', 'down']) }).strict(),
  z.object({ type: z.literal('replace_activity'), itemId: id, candidateId: id }).strict(),
  z.object({ type: z.literal('update_travel_pace'), pace: z.enum(paceOptions) }).strict(),
  z.object({ type: z.literal('set_segment_mode'), segmentId: id, mode: z.enum(['walk', 'drive', 'bicycle']) }).strict(),
]);
export type AssistantAction = z.infer<typeof actionSchema>;
export const topics = ['trip', 'budget', 'itinerary', 'accommodation', 'transport', 'journeys', 'conflicts', 'unknown_costs', 'help'] as const;
export type Topic = (typeof topics)[number];
export const interpretationSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('read'), topic: z.enum(topics), day: z.number().int().min(1).max(366).optional() }).strict(),
  z.object({ kind: z.literal('action'), tripId: id, action: actionSchema }).strict(),
  z.object({ kind: z.literal('clarification'), message: z.string().min(1).max(1000) }).strict(),
]);
export type Interpretation = z.infer<typeof interpretationSchema>;
export type Proposal = {
  id: string; tripId: string; revision: string; action: AssistantAction;
  title: string; before: string; after: string; impact: string;
  status: 'pending' | 'applying' | 'applied' | 'cancelled' | 'failed';
};
export type AssistantResponse = {
  kind: 'answer' | 'proposal' | 'clarification' | 'error'; message: string;
  sources: string[]; proposal?: Proposal;
};
export type ConversationEntry = { id: string; role: 'user' | 'assistant'; message: string; response?: AssistantResponse };
