import { ArrowRight, Minus, Plus } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useBlocker, useNavigate } from 'react-router-dom';
import { Button } from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { StatusMessage } from '../../../components/ui/StatusMessage';
import { accommodationOptions, defaultPreferences, interestOptions, paceOptions, supportedCurrencies, transportationOptions, type CreateTripInput, type Currency, type Trip } from '../types/trip';
import { createTripSchema, isRealDateOnly, normalizeLocation } from '../validation/tripSchema';
import { durationLabel, preferenceLabel } from '../utils/tripFormatters';
import { TripDetails } from './TripDetails';
import styles from './TripPlanner.module.css';

type PlannerValues = Omit<CreateTripInput, 'travelers' | 'budget' | 'preferences'> & {
  travelers: string;
  budget: { amount: string; currency: Currency };
  preferences: ReturnType<typeof defaultPreferences>;
};

function initialValues(trip?: Trip): PlannerValues {
  return {
    origin: trip?.origin ?? '', destination: trip?.destination ?? '',
    startDate: trip?.startDate ?? '', endDate: trip?.endDate ?? '',
    travelers: String(trip?.travelers ?? 1),
    budget: { amount: trip ? String(trip.budget.amount) : '', currency: trip?.budget.currency ?? 'EUR' },
    preferences: trip?.preferences ? { ...trip.preferences, transportation: [...trip.preferences.transportation], interests: [...trip.preferences.interests] } : defaultPreferences(),
  };
}

function Section({ number, title, description, children }: { number: string; title: string; description: string; children: ReactNode }) {
  return <section className={styles.section} aria-labelledby={`section-${number}`}>
    <div className={styles.sectionHeading}><span>{number}</span><div><h2 id={`section-${number}`}>{title}</h2><p>{description}</p></div></div>{children}
  </section>;
}

function changeImpact(trip: Trip | undefined, review: CreateTripInput | null) {
  if (!trip || !review) return null;
  const impacts: string[] = [];
  if (normalizeLocation(trip.origin).toLocaleLowerCase() !== normalizeLocation(review.origin).toLocaleLowerCase()) impacts.push('Saved long-distance journeys will be preserved but marked for route review because the origin changed.');
  if (normalizeLocation(trip.destination).toLocaleLowerCase() !== normalizeLocation(review.destination).toLocaleLowerCase()) impacts.push('Destination-specific itinerary, place, stay and route data will be preserved but marked for review; the confirmed destination reference will be cleared.');
  if (trip.startDate !== review.startDate || trip.endDate !== review.endDate) impacts.push('The saved itinerary, planned stay and long-distance journeys will be preserved but marked for review against the new dates.');
  if (trip.travelers !== review.travelers) impacts.push('Per-person activity estimates will recalculate; the planned stay and provider travel offers will need traveler-count review.');
  if (trip.budget.currency !== review.budget.currency) impacts.push(`Manual expenses keep their original ${trip.budget.currency} amounts and are not converted to ${review.budget.currency}.`);
  const priorPreferences = trip.preferences ?? defaultPreferences();
  const planningChanged = trip.budget.amount !== review.budget.amount || JSON.stringify({ ...priorPreferences, notes: undefined }) !== JSON.stringify({ ...review.preferences, notes: undefined });
  if (planningChanged) impacts.push('The existing itinerary remains saved but may be marked outdated for the new planning constraints.');
  return impacts.join(' ');
}

export function TripPlannerForm({ trip, onSave, onSaved }: {
  trip?: Trip;
  onSave: (input: CreateTripInput) => Promise<Trip>;
  onSaved: (saved: Trip) => void;
}) {
  const navigate = useNavigate();
  const [initial] = useState(() => initialValues(trip));
  const [initialParsed] = useState(() => createTripSchema.safeParse(initial));
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [review, setReview] = useState<CreateTripInput | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const allowLeaveRef = useRef(false);
  const [leaveTarget, setLeaveTarget] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const currentParsed = createTripSchema.safeParse(values);
  const dirty = initialParsed.success && currentParsed.success
    ? JSON.stringify(initialParsed.data) !== JSON.stringify(currentParsed.data)
    : JSON.stringify(initial) !== JSON.stringify(values);
  const returnTo = trip ? `/trips/${trip.id}` : '/trips';
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && !savingRef.current && !allowLeaveRef.current && currentLocation.key !== nextLocation.key);

  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [dirty]);

  useEffect(() => { if (review) headingRef.current?.focus(); }, [review]);

  const change = <K extends keyof PlannerValues>(key: K, value: PlannerValues[K]) => {
    setValues((current) => current[key] === value ? current : { ...current, [key]: value });
  };
  const preference = <K extends keyof PlannerValues['preferences']>(key: K, value: PlannerValues['preferences'][K]) => {
    setValues((current) => ({ ...current, preferences: { ...current.preferences, [key]: value } }));
  };
  const validate = () => {
    const result = createTripSchema.safeParse(values);
    if (!result.success) {
      const next: Record<string, string> = {};
      for (const issue of result.error.issues) next[issue.path.join('.')] ??= issue.message;
      setErrors(next);
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return null;
    }
    setErrors({});
    return result.data;
  };
  const submit = async () => {
    if (savingRef.current) return;
    const input = validate();
    if (!input) { setReview(null); return; }
    savingRef.current = true;
    setSaving(true);
    setSaveError(null);
    try { onSaved(await onSave(input)); }
    catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : 'Your trip could not be saved. Please try again.');
      savingRef.current = false;
      setSaving(false);
    }
  };
  const errorProps = (key: string) => ({ 'aria-invalid': Boolean(errors[key]), 'aria-describedby': errors[key] ? `${key}-error` : undefined });
  const error = (key: string) => errors[key] ? <span id={`${key}-error`} className={styles.error}>{errors[key]}</span> : null;
  const validDates = isRealDateOnly(values.startDate) && isRealDateOnly(values.endDate) && values.endDate >= values.startDate;
  const sameLocation = normalizeLocation(values.origin).toLocaleLowerCase() === normalizeLocation(values.destination).toLocaleLowerCase() && values.origin.trim() !== '';
  const cancel = () => dirty ? setLeaveTarget(returnTo) : navigate(returnTo);
  const impact = changeImpact(trip, review);

  return <div className={styles.planner}>
    {!review ? <form ref={formRef} className={styles.form} noValidate onSubmit={(event) => { event.preventDefault(); const input = validate(); if (input) setReview(input); }}>
      <p className={styles.requiredNote}>Route, dates, travelers and total budget are required.</p>
      {Object.keys(errors).length > 0 && <StatusMessage>Please check the highlighted fields before reviewing your trip.</StatusMessage>}
      <Section number="01" title="Where & when" description="Set your route and travel dates.">
        <div className={styles.twoColumns}>
          {(['origin', 'destination'] as const).map((key) => <div className={styles.field} key={key}><label htmlFor={key}>{key === 'origin' ? 'Origin' : 'Destination'}</label><input id={key} required maxLength={120} autoComplete="off" placeholder={key === 'origin' ? 'City or place you are leaving from' : 'City or place you are traveling to'} value={values[key]} onChange={(event) => change(key, event.target.value)} {...errorProps(key)} />{error(key)}</div>)}
          {(['startDate', 'endDate'] as const).map((key) => <div className={styles.field} key={key}><label htmlFor={key}>{key === 'startDate' ? 'Start date' : 'End date'}</label><input id={key} type="date" required value={values[key]} onInput={(event) => change(key, event.currentTarget.value)} onChange={(event) => change(key, event.target.value)} {...errorProps(key)} />{error(key)}</div>)}
        </div>
        {sameLocation && <p className={styles.hint} role="status">Both places have the same name. Add a country or region if they are different locations, or keep them for a round trip.</p>}
        {validDates && <p className={styles.duration} role="status">{durationLabel(values.startDate, values.endDate)}</p>}
      </Section>
      <Section number="02" title="People & budget" description="Your budget covers the entire trip for all travelers.">
        <div className={styles.twoColumns}>
          <div className={styles.field}><label htmlFor="travelers">Travelers</label><div className={styles.counter}>
            <button type="button" aria-label="Remove one traveler" disabled={!Number.isInteger(Number(values.travelers)) || Number(values.travelers) <= 1} onClick={() => change('travelers', String(Number(values.travelers) - 1))}><Minus size={16} /></button>
            <input id="travelers" type="number" required min="1" step="1" value={values.travelers} inputMode="numeric" onChange={(event) => change('travelers', event.target.value)} {...errorProps('travelers')} />
            <button type="button" aria-label="Add one traveler" onClick={() => change('travelers', String(Math.max(1, Math.floor(Number(values.travelers) || 1)) + 1))}><Plus size={16} /></button>
          </div>{error('travelers')}</div>
          <div className={styles.field}><label htmlFor="currency">Currency</label><select id="currency" value={values.budget.currency} onChange={(event) => change('budget', { ...values.budget, currency: event.target.value as Currency })} {...errorProps('budget.currency')}>{supportedCurrencies.map((currency) => <option key={currency}>{currency}</option>)}</select>{error('budget.currency')}</div>
          <div className={`${styles.field} ${styles.fullWidth}`}><label htmlFor="budget">Total trip budget</label><div className={styles.moneyInput}><span>{values.budget.currency}</span><input id="budget" type="number" required min="0" step="any" inputMode="decimal" placeholder="0.00" value={values.budget.amount} onChange={(event) => change('budget', { ...values.budget, amount: event.target.value })} {...errorProps('budget.amount')} /></div>{error('budget.amount')}<span className={styles.hint}>For all travelers. Changing currency keeps the amount; no exchange-rate conversion is applied.</span></div>
        </div>
      </Section>
      <Section number="03" title="Travel style" description="Tell us how you prefer to explore. These choices are optional.">
        <div className={styles.field}><label htmlFor="accommodation">Accommodation</label><select id="accommodation" value={values.preferences.accommodation} onChange={(event) => preference('accommodation', event.target.value as PlannerValues['preferences']['accommodation'])}>{accommodationOptions.map((option) => <option key={option} value={option}>{preferenceLabel(option)}</option>)}</select></div>
        <fieldset className={styles.choices}><legend>Local transportation</legend><p>Getting around within your destination. Select any that suit you.</p><div className={styles.chips}>{transportationOptions.map((option) => <label key={option}><input type="checkbox" checked={values.preferences.transportation.includes(option)} onChange={(event) => preference('transportation', event.target.checked ? [...values.preferences.transportation, option] : values.preferences.transportation.filter((value) => value !== option))} /><span>{preferenceLabel(option)}</span></label>)}</div><span className={styles.hint}>No selections means flexible / no preference.</span></fieldset>
        <fieldset className={styles.choices}><legend>Activities & interests</legend><p>Select as many as you like.</p><div className={styles.chips}>{interestOptions.map((option) => <label key={option}><input type="checkbox" checked={values.preferences.interests.includes(option)} onChange={(event) => preference('interests', event.target.checked ? [...values.preferences.interests, option] : values.preferences.interests.filter((value) => value !== option))} /><span>{preferenceLabel(option)}</span></label>)}</div></fieldset>
        <fieldset className={styles.choices}><legend>Travel pace</legend><div className={styles.paces}>{paceOptions.map((option) => <label key={option}><input type="radio" name="pace" value={option} checked={values.preferences.pace === option} onChange={() => preference('pace', option)} /><span><strong>{preferenceLabel(option)}</strong><small>{option === 'relaxed' ? 'Fewer activities, more free time.' : option === 'balanced' ? 'Moderate daily planning.' : 'More activities, busier days.'}</small></span></label>)}</div></fieldset>
        <details className={styles.optional}><summary>Additional preferences <span>Optional</span></summary><div className={styles.field}><label htmlFor="notes">Anything else we should consider?</label><textarea id="notes" rows={3} maxLength={1000} placeholder="e.g. Prefer outdoor activities or shorter travel distances" value={values.preferences.notes ?? ''} onChange={(event) => preference('notes', event.target.value)} {...errorProps('preferences.notes')} />{error('preferences.notes')}<span className={styles.hint}>{(values.preferences.notes ?? '').length}/1,000 characters</span></div></details>
      </Section>
      <div className={styles.actions}><Button type="button" variant="secondary" onClick={cancel}>Cancel</Button><Button type="submit">Review trip <ArrowRight size={16} /></Button></div>
    </form> : <section className={styles.review} aria-labelledby="review-heading">
      <div className={styles.sectionHeading}><span>04</span><div><h2 id="review-heading" tabIndex={-1} ref={headingRef}>Review your trip</h2><p>Check the details before {trip ? 'saving your changes' : 'creating your trip'}.</p></div></div>
      <TripDetails trip={review} />
      {impact && <StatusMessage role="status">{impact}</StatusMessage>}
      {saveError && <StatusMessage>{saveError}</StatusMessage>}
      <div className={styles.actions}><Button type="button" variant="secondary" disabled={saving} onClick={() => { setReview(null); setSaveError(null); requestAnimationFrame(() => formRef.current?.querySelector<HTMLInputElement>('input')?.focus()); }}>Back to edit</Button><Button type="button" disabled={saving} onClick={() => void submit()}>{saving ? 'Saving…' : trip ? 'Save changes' : 'Create trip'}<ArrowRight size={16} /></Button></div>
    </section>}
    <ConfirmDialog open={leaveTarget !== null || blocker.state === 'blocked'} title="Discard unsaved changes?" description="Your changes have not been saved. Leave this planner and discard them?" confirmLabel="Discard changes" onConfirm={() => {
      allowLeaveRef.current = true;
      if (blocker.state === 'blocked') blocker.proceed();
      else if (leaveTarget) navigate(leaveTarget);
    }} onCancel={() => { setLeaveTarget(null); if (blocker.state === 'blocked') blocker.reset(); }} />
  </div>;
}
