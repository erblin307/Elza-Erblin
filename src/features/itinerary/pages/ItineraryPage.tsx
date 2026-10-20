import { useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTrips } from '../../../app/providers/TripsProvider';
import { Button } from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { StatusMessage } from '../../../components/ui/StatusMessage';
import { useWorkspaceTrip } from '../../trips/components/TripWorkspaceLayout';
import type { Trip } from '../../trips/types/trip';
import { isItineraryStale } from '../domain/context';
import { costSummary, formatMoney } from '../domain/costs';
import { editItinerary, type ItineraryEdit } from '../domain/editing';
import { generateTripItinerary, InsufficientActivityDataError, type CandidateSourceMode } from '../services/itineraryGenerator';
import { ItineraryTimeline } from '../components/ItineraryTimeline';
import styles from '../components/Itinerary.module.css';
import { geoapifyConfigured } from '../../places/services/providerConfig';
import { scheduleIssues } from '../../long-distance-transport/domain/schedule';

function ItineraryContent({ trip }: { trip: Trip }) {
  const { saveItinerary, getItineraryWarning } = useTrips();
  const itinerary = trip.itinerary;
  const [query] = useSearchParams();
  const savedWarning = getItineraryWarning(trip.id);
  const [sourceMode, setSourceMode] = useState<CandidateSourceMode>(itinerary?.metadata.sourceLabel.startsWith('Geographic development') ? 'geographic-demo' : itinerary?.metadata.dataMode ?? 'live');
  const [allowance, setAllowance] = useState(String(itinerary && itinerary.context.currency === trip.budget.currency ? Math.min(itinerary.config.activityAllowance, trip.budget.amount) : Math.floor(trip.budget.amount * 20) / 100));
  const [phase, setPhase] = useState<'generating' | 'saving' | null>(null);
  const pendingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [noData, setNoData] = useState(false);
  const [confirmation, setConfirmation] = useState(false);
  const [activeDay, setActiveDay] = useState<string | null>(query.get('day'));
  const stale = itinerary ? isItineraryStale(trip, itinerary) : false;
  const day = itinerary?.days.find((day) => day.id === activeDay) ?? itinerary?.days[0];
  const travelIssues = scheduleIssues(trip);

  const generate = async () => {
    if (pendingRef.current) return;
    const amount = Number(allowance);
    if (!allowance.trim() || !Number.isFinite(amount) || amount < 0 || amount > trip.budget.amount) { setError('Enter a nonnegative activity allowance no larger than the total trip budget.'); setConfirmation(false); return; }
    pendingRef.current = true;
    setPhase('generating'); setError(null); setNoData(false); setConfirmation(false);
    try {
      const generated = await generateTripItinerary(trip, amount, sourceMode);
      await saveItinerary(trip.id, generated);
      setActiveDay(generated.days[0]?.id ?? null);
    } catch (cause) {
      if (cause instanceof InsufficientActivityDataError) setNoData(true);
      else setError(cause instanceof Error ? cause.message : 'We could not generate your itinerary. Your trip information is safe.');
    } finally { pendingRef.current = false; setPhase(null); }
  };

  const applyEdit = async (action: ItineraryEdit) => {
    if (!itinerary || stale || pendingRef.current) return;
    pendingRef.current = true; setPhase('saving'); setError(null);
    try { await saveItinerary(trip.id, editItinerary(itinerary, action)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'This change could not be saved. Your current itinerary is unchanged.'); }
    finally { pendingRef.current = false; setPhase(null); }
  };

  const totals = itinerary ? costSummary(itinerary.days.flatMap((day) => day.items), itinerary.catalog, itinerary.context) : null;
  return <div className={styles.page}>
    <div className={styles.pageHeading}><h2>Itinerary</h2><p>A proposed day-by-day plan based on your saved trip preferences.</p></div>
    {savedWarning && <StatusMessage>{savedWarning}</StatusMessage>}
    {stale && <div className={styles.notice} role="status"><strong>Trip preferences changed.</strong> Your saved itinerary is outdated. Manual work is preserved; regenerate to use current dates, preferences and budget. Editing is paused until then.</div>}
    {travelIssues.some((issue) => issue.kind === 'conflict' || issue.kind === 'overlap') && <div className={styles.notice} role="alert"><strong>Your selected travel schedule conflicts with planned activities.</strong> Review the affected first or last day. Manual itinerary edits remain preserved until you explicitly regenerate or edit them.</div>}
    {travelIssues.some((issue) => issue.kind === 'uncertain') && <p className={styles.helper}>Travel timing check is incomplete because station/airport transfer time or timezone evidence is unavailable.</p>}
    <form className={styles.generationControls} onSubmit={(event) => { event.preventDefault(); if (itinerary || savedWarning) setConfirmation(true); else void generate(); }}>
      <label>Activity data source<select value={sourceMode} disabled={!!phase} onChange={(event) => setSourceMode(event.target.value as CandidateSourceMode)}><option value="live">{geoapifyConfigured ? 'Geoapify — live candidates' : 'Live provider — key not configured'}</option><option value="demo">Demonstration fixtures — Rome / Vienna</option><option value="geographic-demo">Geographic demonstration — sourced landmarks</option></select></label>
      <label>Activity allowance ({trip.budget.currency})<input type="number" min="0" step="any" value={allowance} disabled={!!phase} onChange={(event) => setAllowance(event.target.value)} /></label>
      <Button type="submit" disabled={!!phase}>{phase === 'generating' ? 'Generating…' : itinerary ? 'Regenerate itinerary' : 'Generate itinerary'}</Button>
    </form>
    <p className={styles.helper}>Applied when generating a new plan; defaults to 20% of your total budget. Only comparable known activity estimates are constrained; accommodation, flights, food, transport and unknown prices are not accounted for.</p>
    {sourceMode !== 'live' && <p className={styles.sourceNotice}>The selected generator uses isolated sample activities for Rome or Vienna. Costs are synthetic planning inputs when supplied by this generator, not actual ticket prices. {sourceMode === 'geographic-demo' || itinerary?.catalog.some((candidate) => candidate.place?.provider === 'fixture') ? 'Landmark coordinates are static sourced snapshots, not live Places results; generic activities remain unmapped. Hours and routing are not supplied.' : 'Generic samples do not supply hours, coordinates or routing.'}</p>}
    {phase && <p role="status" aria-live="polite" className={styles.feedback}>{phase === 'generating' ? 'Retrieving candidates and building the proposed schedule…' : 'Saving your itinerary change…'}</p>}
    {error && <div className={styles.error}><StatusMessage>{error}</StatusMessage></div>}
    {noData && <div className={styles.notice} role="status"><strong>No activity data available for this destination.</strong> Place discovery is not configured for this location or no suitable candidates fit your inputs. Choose a fixture-supported demonstration destination or keep your existing plan.</div>}
    {itinerary && day && totals ? <>
      <div className={styles.planSummary}><strong>{itinerary.metadata.sourceLabel.startsWith('Mixed itinerary') ? 'Mixed itinerary — provider places and demonstration fixtures' : itinerary.metadata.dataMode === 'demo' ? 'Demonstration itinerary' : 'Suggested itinerary'}</strong><span>Known estimated activity costs: {formatMoney(totals.knownCost, itinerary.context.currency)} of {formatMoney(itinerary.config.activityAllowance, itinerary.context.currency)} allowance{totals.unknownCount > 0 && ` · ${totals.unknownCount} costs unknown or non-comparable`}</span><small>{itinerary.metadata.manuallyAdjusted ? 'Manually adjusted · ' : ''}{itinerary.metadata.sourceLabel}</small></div>
      <p className={styles.helper}>All times are suggested. Opening hours are unverified unless a source window is supplied. Travel transitions show provider estimates only after calculation in Transport; other connections remain unknown.</p>
      <details className={styles.assumptions}><summary>Planning assumptions and limitations</summary><ul>{itinerary.metadata.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul><p>Unknown durations use {itinerary.config.unknownDurationMinutes} minutes. Gaps reserve at least {itinerary.config.bufferMinutes} minutes without claiming a travel duration. Proposed schedules are not bookings.</p></details>
      <nav className={styles.dayNavigation} aria-label="Itinerary days">{itinerary.days.map((entry, index) => <button key={entry.id} type="button" aria-pressed={entry.id === day.id} onClick={() => setActiveDay(entry.id)} title={entry.date}>Day {index + 1}</button>)}</nav>
      <ItineraryTimeline key={day.id} itinerary={itinerary} day={day} selectedItemId={query.get('item')} busy={!!phase || stale} onEdit={(action) => void applyEdit(action)} />
    </> : <section className={styles.empty}><h3>Build your itinerary</h3><p>Create a day-by-day plan from available activity data and your saved preferences. No activities are added before you generate a plan.</p></section>}
    <ConfirmDialog open={confirmation} title="Generate a new plan?" description="This will replace the current saved itinerary, including manual changes. The existing plan stays intact if generation or saving fails." confirmLabel="Regenerate" variant="primary" busy={!!phase} onConfirm={() => void generate()} onCancel={() => setConfirmation(false)} />
  </div>;
}

export function ItineraryPage() {
  const trip = useWorkspaceTrip();
  return <ItineraryContent key={trip.id} trip={trip} />;
}
