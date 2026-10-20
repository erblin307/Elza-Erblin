import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useWorkspaceTrip } from '../../trips/components/TripWorkspaceLayout';
import { useTrips } from '../../../app/providers/TripsProvider';
import { Button } from '../../../components/ui/Button';
import { StatusMessage } from '../../../components/ui/StatusMessage';
import type { ConversationEntry } from '../domain/contracts';
import styles from './AssistantPage.module.css';

const suggestions = ['Summarize my trip', 'Review my budget', 'Identify schedule conflicts', 'When do I arrive?', 'Find alternative places', 'Help'];
export function AssistantPage() {
  const trip = useWorkspaceTrip();
  return <TripAssistant key={trip.id} tripId={trip.id} title={trip.title} hasDays={Boolean(trip.itinerary?.days.length)} />;
}
function TripAssistant({ tripId, title, hasDays }: { tripId: string; title: string; hasDays: boolean }) {
  const { assistant } = useTrips();
  const [entries, setEntries] = useState<ConversationEntry[]>(() => assistant.history(tripId));
  const [input, setInput] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const lock = useRef(false); const controller = useRef<AbortController | null>(null); const end = useRef<HTMLDivElement>(null);
  useEffect(() => () => { controller.current?.abort(); }, []);
  useEffect(() => { end.current?.scrollIntoView?.({ block: 'nearest' }); }, [entries.length]);
  const sync = () => setEntries(assistant.history(tripId));
  const send = async (message: string) => {
    if (lock.current || !message.trim()) return;
    lock.current = true; setBusy(true); setError(null); controller.current = new AbortController();
    try { await assistant.ask(tripId, message, controller.current.signal); if (!controller.current.signal.aborted) { sync(); setInput(''); } }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Request failed.'); }
    finally { lock.current = false; setBusy(false); }
  };
  const act = async (proposalId: string, apply: boolean) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(null);
    try { if (apply) await assistant.apply(tripId, proposalId); else assistant.cancel(tripId, proposalId); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'The change could not be saved.'); }
    finally { sync(); lock.current = false; setBusy(false); }
  };
  return <section className={styles.page} aria-labelledby="assistant-title">
    <header className={styles.header}><div><p className={styles.eyebrow}>Trip planning copilot</p><h2 id="assistant-title">Assistant</h2><p>Planning help for {title}</p></div><span className={styles.mode}>Local · deterministic</span></header>
    <p className={styles.notice}>Uses saved Trip data and supported commands. No generative AI is connected. Places and route requests use the existing providers when configured.</p>
    <div className={styles.suggestions} aria-label="Suggested questions">{[...suggestions, ...(hasDays ? ['What is planned for Day 1?', 'Make Day 1 more relaxed'] : [])].map((message) => <button key={message} disabled={busy} onClick={() => void send(message)}>{message}</button>)}</div>
    <div className={styles.conversation} role="log" aria-label="Trip conversation" aria-live="polite" aria-relevant="additions text">
      {!entries.length && <div className={styles.empty}><h3>Start with your plan</h3><p>Ask about your itinerary, budget, stay or journeys. Changes appear as a preview for you to review.</p></div>}
      {entries.map((entry) => <article key={entry.id} className={`${styles.message} ${entry.role === 'user' ? styles.user : ''}`}><p className={styles.role}>{entry.role === 'user' ? 'You' : 'Planning assistant'}</p><p className={styles.copy}>{entry.message}</p>
        {entry.response?.sources.length ? <small className={styles.sources}>Sources: {entry.response.sources.join(' · ')}</small> : null}
        {entry.response?.proposal && <section className={styles.preview} aria-label="Proposed change"><h3>{entry.response.proposal.title}</h3><p>Trip: {title}</p><div className={styles.comparison}><div><h4>Before</h4><p>{entry.response.proposal.before}</p></div><div><h4>After</h4><p>{entry.response.proposal.after}</p></div></div><p className={styles.impact}>{entry.response.proposal.impact}</p>{entry.response.proposal.status === 'pending' ? <div className={styles.actions}><Button variant="secondary" disabled={busy} onClick={() => void act(entry.response!.proposal!.id, false)}>Cancel proposal</Button><Button disabled={busy} onClick={() => void act(entry.response!.proposal!.id, true)}>Apply change</Button></div> : <p className={styles.outcome}>Proposal {entry.response.proposal.status}.</p>}</section>}
      </article>)}<div ref={end} />
    </div>
    {busy && <p role="status">Checking the active Trip…</p>}{error && <StatusMessage>{error}</StatusMessage>}
    <form className={styles.composer} onSubmit={(e) => { e.preventDefault(); void send(input); }}><label htmlFor="assistant-message">Ask about this Trip</label><textarea id="assistant-message" maxLength={2000} rows={3} value={input} disabled={busy} onChange={(e) => setInput(e.target.value)} placeholder={'Try: move "exact activity name" to day 2'} /><div className={styles.actions}><small>{input.length}/2,000</small><Button type="submit" disabled={busy || !input.trim()}>Send</Button></div></form>
    <footer className={styles.footer}><span>Conversation stays in memory for this browser session; refresh clears it. Confirmed changes are saved with your Trip.</span><button disabled={busy || !entries.length} onClick={() => { assistant.clear(tripId); sync(); }}>Clear conversation</button></footer>
    <nav className={styles.links} aria-label="Related workspaces">{['itinerary', 'map', 'transport', 'budget', 'places'].map((path) => <Link key={path} to={`/trips/${encodeURIComponent(tripId)}/${path}`}>{path[0]!.toUpperCase() + path.slice(1)}</Link>)}</nav>
  </section>;
}
