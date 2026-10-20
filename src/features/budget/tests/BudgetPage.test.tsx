import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { ThemeProvider } from '../../../app/providers/ThemeProvider';
import { TripsProvider } from '../../../app/providers/TripsProvider';
import { appRoutes } from '../../../app/routes';
import { LocalStorageTripRepository, STORAGE_KEY } from '../../trips/services/LocalStorageTripRepository';
import { createBudgetTrip } from './testData';

function mount(path = '/trips/test-trip/budget') {
  const router = createMemoryRouter(appRoutes, { initialEntries: [path] });
  render(<ThemeProvider><TripsProvider repository={new LocalStorageTripRepository(localStorage)}><RouterProvider router={router} /></TripsProvider></ThemeProvider>);
  return router;
}

describe('Budget workspace', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function(this: HTMLDialogElement) { this.setAttribute('open', ''); } });
    Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function(this: HTMLDialogElement) { this.removeAttribute('open'); } });
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, trips: [createBudgetTrip()] }));
  });

  it('shows authoritative budget, linked itinerary estimates and honest unknown coverage', async () => {
    mount();
    expect(await screen.findByRole('heading', { name: 'Budget for Rome' })).toBeVisible();
    expect(screen.getByText('€500.00')).toBeVisible();
    expect(screen.getAllByText('€110.00')[0]).toBeVisible();
    expect(screen.getByText(/No priced transportation source|Routes provide distance and duration/)).toBeVisible();
    expect(screen.getByText('Museum ticket')).toBeVisible();
    expect(screen.getByText('Private tour')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Budget' })).toHaveAttribute('aria-current', 'page');
  });

  it('adds and edits a persisted manual expense and updates every summary', async () => {
    const user = userEvent.setup(); mount();
    await screen.findByRole('heading', { name: 'Budget for Rome' });
    await user.click(screen.getByRole('button', { name: 'Add expense' }));
    const form = screen.getByRole('form', { name: 'Add expense' });
    await user.type(within(form).getByLabelText('Title'), 'Dinner');
    await user.type(within(form).getByLabelText('Amount'), '40');
    await user.selectOptions(within(form).getByLabelText('Category'), 'food');
    fireEvent.change(within(form).getByLabelText(/Date/), { target: { value: '2027-06-12' } });
    await user.click(within(form).getByRole('button', { name: 'Add expense' }));
    expect(await screen.findByText('Dinner')).toBeVisible();
    expect(screen.getByText('€150.00')).toBeVisible();
    expect((await new LocalStorageTripRepository(localStorage).get('test-trip'))?.budgetLedger?.expenses[0]?.title).toBe('Dinner');

    await user.click(screen.getByRole('button', { name: 'Edit Dinner' }));
    const edit = screen.getByRole('form', { name: 'Edit expense' });
    await user.clear(within(edit).getByLabelText('Amount'));
    await user.type(within(edit).getByLabelText('Amount'), '55');
    await user.click(within(edit).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(screen.getByText('€165.00')).toBeVisible());
    expect((await new LocalStorageTripRepository(localStorage).get('test-trip'))?.budgetLedger?.expenses[0]?.amount).toBe(55);
  });

  it('deletes only the selected manual expense after confirmation', async () => {
    const user = userEvent.setup(); mount(); await screen.findByRole('heading', { name: 'Budget for Rome' });
    await user.click(screen.getByRole('button', { name: 'Add expense' }));
    const form = screen.getByRole('form', { name: 'Add expense' });
    await user.type(within(form).getByLabelText('Title'), 'Souvenirs'); await user.type(within(form).getByLabelText('Amount'), '20');
    await user.click(within(form).getByRole('button', { name: 'Add expense' }));
    await user.click(await screen.findByRole('button', { name: 'Delete Souvenirs' }));
    const dialog = screen.getByRole('dialog'); await user.click(within(dialog).getByRole('button', { name: 'Delete expense' }));
    await waitFor(() => expect(screen.queryByText('Souvenirs')).not.toBeInTheDocument());
    expect((await new LocalStorageTripRepository(localStorage).get('test-trip'))?.budgetLedger?.expenses).toEqual([]);
    expect(screen.getByText('Museum ticket')).toBeVisible();
  });

  it('updates the Overview budget summary from the same source of truth', async () => {
    const router = mount(); await screen.findByRole('heading', { name: 'Budget for Rome' });
    await router.navigate('/trips/test-trip');
    expect(await screen.findByText(/€110.00 known cost/)).toBeVisible();
    expect(screen.getByRole('link', { name: 'Open Budget' })).toBeVisible();
  });
});
