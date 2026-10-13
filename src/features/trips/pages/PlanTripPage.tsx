import { ArrowRight, MapPin } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ZodIssue } from 'zod';
import { useTrips } from '../../../app/providers/TripsProvider';
import { Button } from '../../../components/ui/Button';
import { PageHeader } from '../../../components/ui/PageHeader';
import { StatusMessage } from '../../../components/ui/StatusMessage';
import { supportedCurrencies, type CreateTripInput } from '../types/trip';
import { createTripSchema } from '../validation/tripSchema';
import page from './Page.module.css';
import styles from './PlanTripPage.module.css';

type FieldErrors = Partial<Record<'origin' | 'destination' | 'startDate' | 'endDate' | 'travelers' | 'budget.amount' | 'budget.currency', string>>;

function errorsFromIssues(issues: ZodIssue[]) {
  return issues.reduce<FieldErrors>((errors, issue) => {
    const key = issue.path.join('.') as keyof FieldErrors;
    if (!errors[key]) errors[key] = issue.message;
    return errors;
  }, {});
}

function FieldError({ id, message }: { id: string; message?: string }) { return message ? <span id={id} className={styles.error}>{message}</span> : null; }

export function PlanTripPage() {
  const navigate = useNavigate();
  const { createTrip } = useTrips();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError(null);
    const form = new FormData(event.currentTarget);
    const result = createTripSchema.safeParse({
      origin: form.get('origin'), destination: form.get('destination'), startDate: form.get('startDate'), endDate: form.get('endDate'),
      travelers: form.get('travelers'), budget: { amount: form.get('budget'), currency: form.get('currency') },
    });
    if (!result.success) { setErrors(errorsFromIssues(result.error.issues)); return; }
    setErrors({});
    setSubmitting(true);
    try {
      const trip = await createTrip(result.data as CreateTripInput);
      navigate(`/trips/${trip.id}`);
    } catch (cause) {
      setSubmitError(cause instanceof Error ? cause.message : 'The trip could not be created.');
      setSubmitting(false);
    }
  };

  const errorProps = (key: keyof FieldErrors) => ({ 'aria-invalid': Boolean(errors[key]), 'aria-describedby': errors[key] ? `${key}-error` : undefined });

  return (
    <div className={page.page}>
      <PageHeader title="Plan a Trip" description="Start with the essentials. You can expand the plan in later milestones." />
      <div className={`${page.content} ${styles.layout}`}>
        <form className={styles.form} onSubmit={(event) => void handleSubmit(event)} noValidate>
          <section className={styles.section} aria-labelledby="route-heading"><div className={styles.sectionHeading}><span>01</span><div><h2 id="route-heading">Route</h2><p>Where will this journey begin and end?</p></div></div>
            <div className={styles.routeFields}>
              <label className={styles.field}><span>Origin</span><div className={styles.inputWrap}><MapPin size={16} aria-hidden="true" /><input name="origin" autoComplete="off" placeholder="e.g. Pristina" {...errorProps('origin')} /></div><FieldError id="origin-error" message={errors.origin} /></label>
              <ArrowRight className={styles.routeArrow} size={18} aria-hidden="true" />
              <label className={styles.field}><span>Destination</span><div className={styles.inputWrap}><MapPin size={16} aria-hidden="true" /><input name="destination" autoComplete="off" placeholder="e.g. Vienna" {...errorProps('destination')} /></div><FieldError id="destination-error" message={errors.destination} /></label>
            </div>
          </section>
          <section className={styles.section} aria-labelledby="dates-heading"><div className={styles.sectionHeading}><span>02</span><div><h2 id="dates-heading">Travel dates</h2><p>Use calendar dates without arrival-time details.</p></div></div>
            <div className={styles.twoColumns}><label className={styles.field}><span>Start date</span><input type="date" name="startDate" {...errorProps('startDate')} /><FieldError id="startDate-error" message={errors.startDate} /></label><label className={styles.field}><span>End date</span><input type="date" name="endDate" {...errorProps('endDate')} /><FieldError id="endDate-error" message={errors.endDate} /></label></div>
          </section>
          <section className={styles.section} aria-labelledby="details-heading"><div className={styles.sectionHeading}><span>03</span><div><h2 id="details-heading">Trip details</h2><p>Set the party size and working budget.</p></div></div>
            <div className={styles.detailGrid}><label className={styles.field}><span>Travelers</span><input type="number" name="travelers" min="1" max="99" step="1" defaultValue="1" inputMode="numeric" {...errorProps('travelers')} /><FieldError id="travelers-error" message={errors.travelers} /></label><label className={styles.field}><span>Budget</span><input type="number" name="budget" min="0" step="0.01" placeholder="0.00" inputMode="decimal" {...errorProps('budget.amount')} /><FieldError id="budget.amount-error" message={errors['budget.amount']} /></label><label className={styles.field}><span>Currency</span><select name="currency" defaultValue="EUR" {...errorProps('budget.currency')}>{supportedCurrencies.map((currency) => <option key={currency}>{currency}</option>)}</select><FieldError id="budget.currency-error" message={errors['budget.currency']} /></label></div>
          </section>
          {submitError && <StatusMessage>{submitError}</StatusMessage>}
          <div className={styles.actions}><Button type="submit" disabled={submitting}>{submitting ? 'Creating trip…' : 'Create trip'} {!submitting && <ArrowRight size={16} />}</Button></div>
        </form>
        <aside className={styles.note}><strong>Saved on this device</strong><p>Your trip will be stored in this browser. Cloud sync and accounts are not part of this milestone.</p></aside>
      </div>
    </div>
  );
}
