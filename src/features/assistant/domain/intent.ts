import type { Topic } from './contracts';
export type LocalIntent =
  | { kind: 'read'; topic: Topic; day?: number }
  | { kind: 'relax' | 'cheaper' | 'reduce_walking'; day: number }
  | { kind: 'alternatives'; name?: string }
  | { kind: 'remove' | 'move' | 'reorder'; name: string; day?: number; direction?: 'up' | 'down' }
  | { kind: 'pace'; pace: 'relaxed' | 'balanced' | 'active' }
  | { kind: 'unsupported' };

export function interpretLocal(message: string): LocalIntent {
  const text = message.trim().replace(/[?.!]$/u, '');
  if (!text || text.length > 2000) throw new Error('Enter a message of 1–2,000 characters.');
  let m = /^(?:set|update|change)(?: travel)? pace(?: to)? (relaxed|balanced|active)$/iu.exec(text);
  if (m) return { kind: 'pace', pace: m[1]!.toLowerCase() as 'relaxed' | 'balanced' | 'active' };
  m = /^move "(.+)" to day (\d+)$/iu.exec(text);
  if (m) return { kind: 'move', name: m[1]!, day: Number(m[2]) };
  m = /^remove "(.+)"$/iu.exec(text);
  if (m) return { kind: 'remove', name: m[1]! };
  m = /^reorder "(.+)" (up|down)$/iu.exec(text);
  if (m) return { kind: 'reorder', name: m[1]!, direction: m[2]!.toLowerCase() as 'up' | 'down' };
  m = /^make day (\d+) (?:more )?(relaxed|lighter|less busy|cheaper)$/iu.exec(text);
  if (m) return { kind: m[2]!.toLowerCase() === 'cheaper' ? 'cheaper' : 'relax', day: Number(m[1]) };
  m = /^reduce walking (?:on )?day (\d+)$/iu.exec(text);
  if (m) return { kind: 'reduce_walking', day: Number(m[1]) };
  m = /^find (?:alternative places|alternative attractions|alternatives)(?: (?:for|to) "(.+)")?$/iu.exec(text);
  if (m) return { kind: 'alternatives', name: m[1] };
  if (/^(?:help|show (?:available )?supported actions)$/iu.test(text)) return { kind: 'read', topic: 'help' };
  if (/^(?:summari[sz]e my trip|what is my travel plan|trip summary)$/iu.test(text)) return { kind: 'read', topic: 'trip' };
  if (/^(?:review my budget|show my (?:trip )?budget|what is my remaining budget|how much (?:money|budget) do i have left|explain travel costs)$/iu.test(text)) return { kind: 'read', topic: 'budget' };
  if (/^(?:list unknown costs|identify activities with unknown costs)$/iu.test(text)) return { kind: 'read', topic: 'unknown_costs' };
  if (/^(?:summari[sz]e (?:my |the )?itinerary|list planned activities)$/iu.test(text)) return { kind: 'read', topic: 'itinerary' };
  m = /^(?:what (?:is planned|am i doing) (?:on|for) |summari[sz]e )day (\d+)$/iu.exec(text);
  if (m) return { kind: 'read', topic: 'itinerary', day: Number(m[1]) };
  if (/^(?:which hotel did i choose|show (?:my |selected )?accommodation)$/iu.test(text)) return { kind: 'read', topic: 'accommodation' };
  if (/^(?:when do i arrive|summari[sz]e (?:my )?(?:flights|journeys)|show (?:my )?flight plan)$/iu.test(text)) return { kind: 'read', topic: 'journeys' };
  if (/^(?:identify (?:schedule|planning) conflicts|show (?:known )?(?:schedule warnings|planning conflicts))$/iu.test(text)) return { kind: 'read', topic: 'conflicts' };
  if (/^(?:summari[sz]e (?:my )?(?:transport|transportation)|show transport options)$/iu.test(text)) return { kind: 'read', topic: 'transport' };
  return { kind: 'unsupported' };
}
