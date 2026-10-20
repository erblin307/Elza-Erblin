export class ProviderError extends Error {
  constructor(public code: 'configuration' | 'auth' | 'rate-limit' | 'timeout' | 'network' | 'invalid-data', message: string) { super(message); this.name = 'ProviderError'; }
}
type Cached = { value: unknown; expires: number };
export class RequestClient {
  private cache = new Map<string, Cached>();
  private pending = new Map<string, { promise: Promise<unknown>; controller: AbortController }>();
  private calls: number[] = [];
  private blockedUntil = 0;
  constructor(private fetcher: typeof fetch = (...args) => fetch(...args), private limit = 20, private headers: HeadersInit = {}) {}
  async get(url: string, signal?: AbortSignal): Promise<unknown> {
    signal?.throwIfAborted();
    const cached = this.cache.get(url);
    if (cached && cached.expires > Date.now()) return structuredClone(cached.value);
    const pending = this.pending.get(url); if (pending && !pending.controller.signal.aborted) return pending.promise;
    this.calls = this.calls.filter((time) => time > Date.now() - 60_000);
    if (this.blockedUntil > Date.now() || this.calls.length >= this.limit) throw new ProviderError('rate-limit', 'Request limit reached. Wait before trying again.');
    this.calls.push(Date.now());
    const controller = new AbortController(); let timedOut = false;
    const cancel = () => controller.abort(); signal?.addEventListener('abort', cancel, { once: true });
    const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 10_000);
    const request = (async () => {
      try {
        const response = await this.fetcher(url, { signal: controller.signal, headers: this.headers });
        controller.signal.throwIfAborted();
        if (response.status === 429) { this.blockedUntil = Date.now() + Math.max(30, Math.min(300, Number(response.headers.get('Retry-After')) || 60)) * 1000; throw new ProviderError('rate-limit', 'The provider is rate limiting requests. Wait before retrying.'); }
        if (response.status === 401 || response.status === 403) throw new ProviderError('auth', 'Provider authentication failed. Check the key and permitted origins.');
        if (!response.ok) throw new ProviderError('network', 'The provider is temporarily unavailable. Your saved trip is unchanged.');
        let value: unknown;
        try { value = await response.json(); } catch { throw new ProviderError('invalid-data', 'The provider returned malformed JSON.'); }
        if (typeof value !== 'object' || value === null || 'error' in value) throw new ProviderError('invalid-data', 'The provider returned unusable data.');
        if (this.cache.size >= 100) this.cache.delete(this.cache.keys().next().value!);
        this.cache.set(url, { value, expires: Date.now() + 300_000 });
        return value;
      } catch (error) {
        if (timedOut) throw new ProviderError('timeout', 'Provider request timed out. Try again.');
        if (signal?.aborted) throw new DOMException('Request canceled.', 'AbortError');
        if (error instanceof ProviderError) throw error;
        throw new ProviderError('network', 'The provider could not be reached. Check your connection and try again.');
      } finally { clearTimeout(timeout); signal?.removeEventListener('abort', cancel); if (this.pending.get(url)?.controller === controller) this.pending.delete(url); }
    })();
    this.pending.set(url, { promise: request, controller });
    void request.finally(() => { if (this.pending.get(url)?.controller === controller) this.pending.delete(url); }).catch(() => {});
    return request;
  }
}
