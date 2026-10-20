import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useWorkspaceTrip } from '../../trips/components/TripWorkspaceLayout';
import { useTrips } from '../../../app/providers/TripsProvider';
import { Button } from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { StatusMessage } from '../../../components/ui/StatusMessage';
import { calculateBudget, formatDateLabel, formatMoney, statusLabel } from '../domain/engine';
import { createManualExpense, emptyBudgetLedger, expenseCategories, expenseCategoryLabels, updateManualExpense, type ManualExpense, type ManualExpenseInput } from '../domain/model';
import styles from './BudgetPage.module.css';

type Draft = { title: string; amount: string; category: (typeof expenseCategories)[number]; certainty: 'confirmed' | 'estimated'; date: string; note: string };
const emptyDraft = (): Draft => ({ title: '', amount: '', category: 'other', certainty: 'confirmed', date: '', note: '' });

function expenseId() {
  return `manual-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
}

function firstIssue(cause: unknown) {
  if (cause && typeof cause === 'object' && 'issues' in cause && Array.isArray(cause.issues) && cause.issues[0] && typeof cause.issues[0] === 'object' && 'message' in cause.issues[0]) return String(cause.issues[0].message);
  return cause instanceof Error ? cause.message : 'The expense could not be saved.';
}

export function BudgetPage() {
  const trip = useWorkspaceTrip();
  const { saveBudgetLedger, getBudgetWarning } = useTrips();
  const snapshot = useMemo(() => calculateBudget(trip), [trip]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [deleteExpense, setDeleteExpense] = useState<ManualExpense | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ledger = trip.budgetLedger ?? emptyBudgetLedger();
  const warning = getBudgetWarning(trip.id);
  const percent = Math.min(snapshot.usagePercent, 100);
  const sourceExpenses = snapshot.expenses.filter((expense) => expense.source !== 'manual');

  const openAdd = () => { setEditingId(null); setDraft(emptyDraft()); setError(null); setEditorOpen(true); };
  const openEdit = (expense: ManualExpense) => {
    setEditingId(expense.id);
    setDraft({ title: expense.title, amount: expense.currency === trip.budget.currency ? String(expense.amount) : '', category: expense.category, certainty: expense.certainty, date: expense.date ?? '', note: expense.note ?? '' });
    setError(null); setEditorOpen(true);
  };
  const closeEditor = () => { if (!busy) { setEditorOpen(false); setEditingId(null); setError(null); } };
  const saveExpense = async (event: React.FormEvent) => {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError(null);
    try {
      const input: ManualExpenseInput = { ...draft, amount: draft.amount };
      const now = new Date().toISOString();
      const existing = editingId ? ledger.expenses.find((expense) => expense.id === editingId) : undefined;
      const expense = existing ? updateManualExpense(existing, input, trip.budget.currency, now) : createManualExpense(trip, input, expenseId(), now);
      const expenses = existing ? ledger.expenses.map((entry) => entry.id === existing.id ? expense : entry) : [...ledger.expenses, expense];
      await saveBudgetLedger(trip.id, { version: 1, expenses });
      setEditorOpen(false); setEditingId(null); setDraft(emptyDraft());
    } catch (cause) { setError(firstIssue(cause)); }
    finally { setBusy(false); }
  };
  const confirmDelete = async () => {
    if (!deleteExpense || busy) return;
    setBusy(true); setError(null);
    try {
      await saveBudgetLedger(trip.id, { version: 1, expenses: ledger.expenses.filter((expense) => expense.id !== deleteExpense.id) });
      setDeleteExpense(null);
    } catch (cause) { setError(firstIssue(cause)); setDeleteExpense(null); }
    finally { setBusy(false); }
  };

  return <div className={styles.page}>
    <header className={styles.heading}>
      <div><p className={styles.eyebrow}>Cost intelligence</p><h2>Budget for {trip.destination}</h2><p>Known costs are derived from this Trip. Unknown accommodation and transport prices are never treated as free.</p></div>
      <Link to={`/trips/${encodeURIComponent(trip.id)}/edit`}>Edit total budget</Link>
    </header>

    {warning && <StatusMessage>{warning}</StatusMessage>}
    {error && <StatusMessage>{error}</StatusMessage>}

    <section className={styles.summary} aria-labelledby="budget-summary-heading">
      <div className={styles.sectionHeading}><h3 id="budget-summary-heading">Budget summary</h3><span className={`${styles.status} ${styles[snapshot.status]}`}>{statusLabel(snapshot.status)}</span></div>
      <dl className={styles.metrics}>
        <div><dt>Total budget</dt><dd>{formatMoney(trip.budget.amount, trip.budget.currency)}</dd></div>
        <div><dt>Known trip cost</dt><dd>{formatMoney(snapshot.total, trip.budget.currency)}</dd><small>{formatMoney(snapshot.confirmedTotal, trip.budget.currency)} confirmed · {formatMoney(snapshot.estimatedTotal, trip.budget.currency)} estimated</small></div>
        <div><dt>{snapshot.status === 'over' ? 'Over budget' : 'Remaining'}</dt><dd>{formatMoney(snapshot.status === 'over' ? snapshot.overBy : snapshot.remaining, trip.budget.currency)}</dd></div>
      </dl>
      <div className={styles.progressLabel}><span>{snapshot.usagePercent}% of budget represented by known costs</span><span>{snapshot.unknownSourceCount ? 'Incomplete estimate' : 'All current sources priced'}</span></div>
      <div className={styles.progress} role="progressbar" aria-label="Known budget usage" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(Math.round(snapshot.usagePercent), 100)}><span style={{ width: `${percent}%` }} /></div>
      {snapshot.unknownSourceCount > 0 && <p className={styles.caution}>The known total is incomplete because {snapshot.unknownSourceCount} source {snapshot.unknownSourceCount === 1 ? 'cost is' : 'costs are'} unknown or non-comparable.</p>}
    </section>

    <div className={styles.columns}>
      <section className={styles.section} aria-labelledby="category-heading">
        <div className={styles.sectionHeading}><h3 id="category-heading">Category breakdown</h3></div>
        <dl className={styles.breakdown}>{expenseCategories.map((category) => <div key={category}><dt>{expenseCategoryLabels[category]}</dt><dd>{formatMoney(snapshot.categoryTotals[category], trip.budget.currency)}</dd></div>)}</dl>
      </section>
      <section className={styles.section} aria-labelledby="insights-heading">
        <div className={styles.sectionHeading}><h3 id="insights-heading">Budget insights</h3><span>Deterministic</span></div>
        <ul className={styles.insights}>{snapshot.insights.map((insight) => <li key={insight}>{insight}</li>)}</ul>
      </section>
    </div>

    <section className={styles.section} aria-labelledby="daily-heading">
      <div className={styles.sectionHeading}><h3 id="daily-heading">Daily spending</h3><span>Dated costs only</span></div>
      <div className={styles.dailyList}>{snapshot.dailyTotals.map((day, index) => <div key={day.date}><span><strong>Day {index + 1}</strong><small>{formatDateLabel(day.date)}</small></span><strong>{formatMoney(day.total, trip.budget.currency)}</strong></div>)}</div>
      {snapshot.unallocatedExpenseCount > 0 && <p className={styles.helper}>{snapshot.unallocatedExpenseCount} {snapshot.unallocatedExpenseCount === 1 ? 'expense has' : 'expenses have'} no date within this Trip and {snapshot.unallocatedExpenseCount === 1 ? 'appears' : 'appear'} only in overall/category totals.</p>}
    </section>

    <section className={styles.section} aria-labelledby="coverage-heading">
      <div className={styles.sectionHeading}><h3 id="coverage-heading">Cost coverage</h3><span>Source-linked</span></div>
      <dl className={styles.coverage}>{snapshot.coverage.map((item) => <div key={item.source}><dt>{item.label}<span>{item.status.replace('-', ' ')}</span></dt><dd>{item.detail}</dd></div>)}</dl>
    </section>

    <section className={styles.section} aria-labelledby="expenses-heading">
      <div className={styles.expenseHeading}><div className={styles.sectionHeading}><h3 id="expenses-heading">Expenses</h3><span>Manual and itinerary-linked</span></div><Button type="button" onClick={openAdd}><Plus size={16} aria-hidden="true" />Add expense</Button></div>
      {editorOpen && <form className={styles.form} aria-label={editingId ? 'Edit expense' : 'Add expense'} onSubmit={saveExpense}>
        <div className={styles.formHeading}><h4>{editingId ? 'Edit manual expense' : 'Add manual expense'}</h4><p>{editingId && ledger.expenses.find((expense) => expense.id === editingId)?.currency !== trip.budget.currency ? `This expense was saved in another currency. Re-enter its amount in ${trip.budget.currency}; no conversion is applied.` : `Amounts use ${trip.budget.currency}. No currency conversion is applied.`}</p></div>
        <label>Title<input value={draft.title} maxLength={120} onChange={(event) => setDraft({ ...draft, title: event.target.value })} required /></label>
        <label>Amount<input type="number" inputMode="decimal" min="0.01" step="0.01" value={draft.amount} onChange={(event) => setDraft({ ...draft, amount: event.target.value })} required /></label>
        <label>Category<select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value as Draft['category'] })}>{expenseCategories.map((category) => <option value={category} key={category}>{expenseCategoryLabels[category]}</option>)}</select></label>
        <label>Amount type<select value={draft.certainty} onChange={(event) => setDraft({ ...draft, certainty: event.target.value as Draft['certainty'] })}><option value="confirmed">Confirmed by me</option><option value="estimated">Estimate</option></select></label>
        <label>Date <span>(optional)</span><input type="date" min={trip.startDate} max={trip.endDate} value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} /></label>
        <label className={styles.note}>Note <span>(optional)</span><textarea value={draft.note} maxLength={500} rows={3} onChange={(event) => setDraft({ ...draft, note: event.target.value })} /></label>
        <div className={styles.formActions}><Button type="button" variant="secondary" onClick={closeEditor} disabled={busy}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? 'Saving…' : editingId ? 'Save changes' : 'Add expense'}</Button></div>
      </form>}
      {!ledger.expenses.length && !sourceExpenses.length ? <div className={styles.empty}><strong>No trip expenses yet.</strong><p>Comparable itinerary estimates and manual costs will appear here.</p></div> : <div className={styles.expenseList}>
        {ledger.expenses.map((expense) => <article key={expense.id} className={styles.expenseRow}>
          <div><strong>{expense.title}</strong><p>{expenseCategoryLabels[expense.category]} · Manual · {expense.certainty === 'confirmed' ? 'Confirmed by you' : 'Estimate'}{expense.date ? ` · ${formatDateLabel(expense.date)}` : ''}</p>{expense.note && <small>{expense.note}</small>}{expense.currency !== trip.budget.currency && <small className={styles.caution}>Excluded from totals: saved in {expense.currency}; Trip currency is {trip.budget.currency}.</small>}</div>
          <strong>{formatMoney(expense.amount, expense.currency)}</strong>
          <div className={styles.rowActions}><Button type="button" variant="ghost" onClick={() => openEdit(expense)} aria-label={`Edit ${expense.title}`}><Pencil size={15} aria-hidden="true" />Edit</Button><Button type="button" variant="ghost" onClick={() => setDeleteExpense(expense)} aria-label={`Delete ${expense.title}`}><Trash2 size={15} aria-hidden="true" />Delete</Button></div>
        </article>)}
        {sourceExpenses.map((expense) => <article key={expense.id} className={styles.expenseRow}>
          <div><strong>{expense.title}</strong><p>{expenseCategoryLabels[expense.category]} · {expense.source === 'itinerary' ? 'Itinerary-linked' : 'Travel-linked'} · Estimate{expense.date ? ` · ${formatDateLabel(expense.date)}` : ''}</p>{expense.note && <small>{expense.note}</small>}</div>
          <strong>{formatMoney(expense.amount, expense.currency)}</strong>
          <Link to={`/trips/${encodeURIComponent(trip.id)}/${expense.source === 'itinerary' ? 'itinerary' : 'travel'}`}>{expense.source === 'itinerary' ? 'View itinerary' : 'View travel'}</Link>
        </article>)}
      </div>}
    </section>

    <ConfirmDialog open={Boolean(deleteExpense)} title="Delete this expense?" description={deleteExpense ? `${deleteExpense.title} will be removed from this Trip and all budget totals.` : ''} confirmLabel="Delete expense" busy={busy} onCancel={() => setDeleteExpense(null)} onConfirm={confirmDelete} />
  </div>;
}
