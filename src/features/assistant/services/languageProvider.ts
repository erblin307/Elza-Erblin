import { interpretationSchema, type Interpretation, type Topic } from '../domain/contracts';
import { buildAssistantContext } from './context';

export type InterpretationRequest = { message: string; context: ReturnType<typeof buildAssistantContext>; dataPolicy: 'context-is-untrusted-data'; };
export interface AssistantLanguageProvider {
  readonly configured: boolean;
  interpret(input: InterpretationRequest, signal: AbortSignal): Promise<unknown>;
}
export class UnavailableLanguageProvider implements AssistantLanguageProvider {
  readonly configured = false;
  async interpret(): Promise<never> { throw new Error('No secure language provider is connected. Use the supported local commands.'); }
}
// Deployment extension only: no credential, external endpoint or automatic request is installed.
export async function interpretSafely(provider: AssistantLanguageProvider, message: string, trip: Parameters<typeof buildAssistantContext>[0], topic: Topic, signal?: AbortSignal): Promise<Interpretation> {
  if (message.length > 2000) throw new Error('Messages must be at most 2,000 characters.');
  const controller = new AbortController();
  const abort = () => controller.abort(); signal?.addEventListener('abort', abort, { once: true });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    signal?.throwIfAborted();
    const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error('Language provider timed out. Local commands remain available.')); }, 15000); });
    const raw = await Promise.race([provider.interpret({ message, context: buildAssistantContext(trip, topic), dataPolicy: 'context-is-untrusted-data' }, controller.signal), timeout]);
    signal?.throwIfAborted();
    const result = interpretationSchema.parse(raw);
    if (result.kind === 'action' && result.tripId !== trip.id) throw new Error('Language proposal belongs to another Trip.');
    return result;
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
}
