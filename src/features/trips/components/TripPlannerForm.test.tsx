import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, Link, RouterProvider } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CreateTripInput, Trip } from '../types/trip';
import { TripPlannerForm } from './TripPlannerForm';

const trip: Trip = { id: 'existing', title: 'Rome trip', origin: 'Prishtina', destination: 'Rome', startDate: '2027-06-12', endDate: '2027-06-17', travelers: 2, budget: { amount: 1500, currency: 'EUR' }, createdAt: '2026-10-14T00:00:00.000Z', updatedAt: '2026-10-14T00:00:00.000Z' };
afterEach(cleanup);

function mount(onSave: (input: CreateTripInput) => Promise<Trip>, existing?: Trip) {
  const onSaved = vi.fn();
  const router = createMemoryRouter([{ path: '/', element: <TripPlannerForm trip={existing} onSave={onSave} onSaved={onSaved} /> }]);
  render(<RouterProvider router={router} />);
  return onSaved;
}

describe('Trip planner workflow', () => {
  it('announces field errors and does not save invalid input', async () => {
    const save = vi.fn();
    mount(save);
    await userEvent.click(screen.getByRole('button', { name: 'Review trip' }));
    expect(screen.getByRole('alert')).toHaveTextContent('highlighted fields');
    expect(screen.getByLabelText('Origin')).toHaveAttribute('aria-invalid', 'true');
    expect(save).not.toHaveBeenCalled();
  });

  it('reviews multiple preferences, keeps edits, and creates only once while saving', async () => {
    let resolveSave!: (trip: Trip) => void;
    const save = vi.fn<(input: CreateTripInput) => Promise<Trip>>(() => new Promise<Trip>((resolve) => { resolveSave = resolve; }));
    const onSaved = mount(save);
    for (const [label, value] of [['Origin', ' Prishtina '], ['Destination', 'Rome'], ['Start date', '2027-06-12'], ['End date', '2027-06-17'], ['Travelers', '2'], ['Total trip budget', '1500']]) {
      fireEvent.change(screen.getByLabelText(label!), { target: { value } });
    }
    await userEvent.selectOptions(screen.getByLabelText('Accommodation'), 'hotel');
    for (const name of ['Walking', 'Public transport', 'History', 'Food', 'Architecture']) await userEvent.click(screen.getByRole('checkbox', { name }));
    await userEvent.click(screen.getByRole('button', { name: 'Review trip' }));
    expect(screen.getByText('6 calendar days / 5 nights')).toBeVisible();
    expect(screen.getByText('History, Food, Architecture')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Back to edit' }));
    expect(screen.getByRole('checkbox', { name: 'Architecture' })).toBeChecked();
    await userEvent.click(screen.getByRole('button', { name: 'Review trip' }));
    const create = screen.getByRole('button', { name: 'Create trip' });
    fireEvent.click(create); fireEvent.click(create);
    expect(save).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
    expect(save.mock.calls[0]?.[0]).toMatchObject({ origin: 'Prishtina', preferences: { accommodation: 'hotel', transportation: ['walking', 'public_transport'], interests: ['history', 'food', 'architecture'], pace: 'balanced' } });
    resolveSave(trip);
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(trip));
  });

  it('initializes older trips for editing and allows retry after a failed save', async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error('Storage is full')).mockResolvedValue(trip);
    mount(save, trip);
    expect(screen.getByLabelText('Origin')).toHaveValue('Prishtina');
    expect(screen.getByRole('radio', { name: /Balanced/ })).toBeChecked();
    await userEvent.selectOptions(screen.getByLabelText('Accommodation'), 'apartment');
    await userEvent.click(screen.getByRole('button', { name: 'Review trip' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Storage is full');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(save).toHaveBeenCalledTimes(2);
  });

  it('explains cross-module impact before saving destination and currency changes', async () => {
    mount(vi.fn(), trip);
    await userEvent.clear(screen.getByLabelText('Destination'));
    await userEvent.type(screen.getByLabelText('Destination'), 'Vienna');
    await userEvent.selectOptions(screen.getByLabelText('Currency'), 'USD');
    await userEvent.click(screen.getByRole('button', { name: 'Review trip' }));
    expect(screen.getByRole('status')).toHaveTextContent('Destination-specific itinerary, place, stay and route data will be preserved but marked for review');
    expect(screen.getByRole('status')).toHaveTextContent('Manual expenses keep their original EUR amounts and are not converted to USD');
  });

  it('keeps unsaved edits when navigation is canceled', async () => {
    // jsdom does not implement modal dialog methods; browser QA exercises the native behavior.
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute('open', ''); } });
    Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute('open'); } });
    const save = vi.fn();
    const router = createMemoryRouter([
      { path: '/', element: <><Link to="/trips">My Trips</Link><TripPlannerForm trip={trip} onSave={save} onSaved={vi.fn()} /></> },
      { path: '/trips', element: <h1>Trip library</h1> },
    ]);
    render(<RouterProvider router={router} />);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Nature' }));
    await userEvent.click(screen.getByRole('link', { name: 'My Trips' }));
    const dialog = screen.getByRole('dialog', { name: 'Discard unsaved changes?' });
    expect(dialog).toBeVisible();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('checkbox', { name: 'Nature' })).toBeChecked();
    expect(router.state.location.pathname).toBe('/');
    expect(save).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});
