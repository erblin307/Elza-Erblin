import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appRoutes } from '../../../app/routes';
import { TripsProvider } from '../../../app/providers/TripsProvider';
import { ThemeProvider } from '../../../app/providers/ThemeProvider';
import { LocalStorageTripRepository, STORAGE_KEY } from '../../trips/services/LocalStorageTripRepository';
import { testTrip } from '../../itinerary/tests/testData';

function mount(path = `/trips/${testTrip.id}/travel`) {
  const router = createMemoryRouter(appRoutes, { initialEntries: [path] });
  render(<ThemeProvider><TripsProvider repository={new LocalStorageTripRepository(localStorage)}><RouterProvider router={router} /></TripsProvider></ThemeProvider>);
  return router;
}
beforeEach(() => {
  localStorage.clear(); localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, trips: [testTrip] }));
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute('open', ''); } });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute('open'); } });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('Travel & Flights workspace', () => {
  it('shows Trip context and honest unavailable provider state', async () => {
    mount(); await screen.findByRole('heading', { name: 'Travel & Flights' });
    expect(screen.getByText(/Live flight search is not configured/)).toBeVisible(); expect(screen.getAllByText(new RegExp(testTrip.origin)).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Search flights' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Travel / Flights' })).toHaveAttribute('aria-current', 'page');
  });
  it('adds, edits, reloads and removes a manual train journey', async () => {
    const router = mount(); await screen.findByRole('heading', { name: 'Travel & Flights' });
    await userEvent.click(screen.getByRole('button', { name: 'Add journey manually' }));
    await userEvent.selectOptions(screen.getByLabelText('Mode'), 'train');
    await userEvent.clear(screen.getByLabelText('Departure location')); await userEvent.type(screen.getByLabelText('Departure location'), 'Prishtina station');
    await userEvent.clear(screen.getByLabelText('Arrival location')); await userEvent.type(screen.getByLabelText('Arrival location'), 'Rome Termini');
    await userEvent.clear(screen.getByLabelText(/Arrival local date\/time/)); await userEvent.type(screen.getByLabelText(/Arrival local date\/time/), '2027-06-12T16:00');
    await userEvent.type(screen.getByLabelText(/User-estimated cost/), '45');
    await userEvent.click(screen.getByRole('button', { name: 'Add planned journey' }));
    expect(await screen.findByText(/Train · Prishtina station → Rome Termini/)).toBeVisible();
    expect((await new LocalStorageTripRepository(localStorage).get(testTrip.id))?.longDistanceTravel?.journeys[0]?.cost?.amount).toBe(45);
    await userEvent.click(screen.getByRole('button', { name: 'Edit outbound Train' }));
    await userEvent.clear(screen.getByLabelText(/User-estimated cost/)); await userEvent.type(screen.getByLabelText(/User-estimated cost/), '50');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('User estimate: €50.00')).toBeVisible();
    await router.navigate(`/trips/${testTrip.id}`); expect(await screen.findByRole('heading', { name: 'Long-distance travel' })).toBeVisible(); expect(screen.getByText(/Prishtina station/)).toBeVisible();
    await router.navigate(`/trips/${testTrip.id}/travel`); await screen.findByRole('heading', { name: 'Travel & Flights' });
    await userEvent.click(screen.getByRole('button', { name: 'Remove outbound Train' })); const dialog = screen.getByRole('dialog', { name: 'Remove planned journey?' }); expect(dialog).toHaveTextContent('actual expenses will remain'); await userEvent.click(within(dialog).getByRole('button', { name: 'Remove journey' }));
    expect(await screen.findByText('No outbound or return journey is planned yet.')).toBeVisible();
  });
  it('keeps itinerary and Budget links functional after planning travel', async () => {
    mount(); await screen.findByRole('heading', { name: 'Travel & Flights' });
    expect(screen.getByRole('link', { name: 'Itinerary' })).toHaveAttribute('href', `/trips/${testTrip.id}/itinerary`);
    expect(screen.getByRole('link', { name: 'Budget' })).toHaveAttribute('href', `/trips/${testTrip.id}/budget`);
  });
});
