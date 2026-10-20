import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appRoutes } from '../../../app/routes';
import { TripsProvider } from '../../../app/providers/TripsProvider';
import { ThemeProvider } from '../../../app/providers/ThemeProvider';
import { LocalStorageTripRepository, STORAGE_KEY } from '../services/LocalStorageTripRepository';
import type { Trip } from '../types/trip';

const first: Trip = { id: 'rome', title: 'Rome trip', origin: 'Prishtina', destination: 'Rome', startDate: '2027-06-12', endDate: '2027-06-17', travelers: 2, budget: { amount: 1500, currency: 'EUR' }, preferences: { accommodation: 'hotel', transportation: ['walking', 'public_transport'], interests: ['history', 'food'], pace: 'balanced', notes: 'Prefer outdoor activities.' }, createdAt: '2026-10-14T00:00:00.000Z', updatedAt: '2026-10-14T00:00:00.000Z' };
const second: Trip = { ...first, id: 'vienna', title: 'Vienna trip', destination: 'Vienna', travelers: 1, budget: { amount: 800, currency: 'USD' }, preferences: undefined };

function mount(path = '/trips/rome', repository = new LocalStorageTripRepository(localStorage)) {
  const router = createMemoryRouter(appRoutes, { initialEntries: [path] });
  render(<StrictMode><ThemeProvider><TripsProvider repository={repository}><RouterProvider router={router} /></TripsProvider></ThemeProvider></StrictMode>);
  return router;
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, trips: [first, second] }));
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('Trip workspace integration', () => {
  it('loads the requested ID once and displays real essentials, duration, budget and preferences', async () => {
    const repository = new LocalStorageTripRepository(localStorage);
    const get = vi.spyOn(repository, 'get');
    mount('/trips/rome', repository);
    await screen.findByRole('heading', { name: 'Rome trip' });
    expect(get).toHaveBeenCalledWith('rome');
    expect(get).toHaveBeenCalledTimes(1);
    const essentials = screen.getByRole('region', { name: 'Trip essentials' });
    expect(essentials).toHaveTextContent('Prishtina');
    expect(essentials).toHaveTextContent('Rome');
    expect(essentials).toHaveTextContent('2 travelers');
    expect(essentials).toHaveTextContent('Jun 12, 2027');
    expect(screen.getByRole('region', { name: 'Schedule & duration' })).toHaveTextContent('Calendar days6Accommodation nights5');
    const budget = screen.getByRole('region', { name: 'Total trip budget' });
    expect(budget).toHaveTextContent('€1,500');
    expect(budget).toHaveTextContent('€0.00 known cost · €1,500.00 remaining');
    expect(within(budget).getByRole('link', { name: 'Open Budget' })).toHaveAttribute('href', '/trips/rome/budget');
    const preferences = screen.getByRole('region', { name: 'Travel preferences' });
    expect(preferences).toHaveTextContent('Hotel');
    expect(preferences).toHaveTextContent('Walking, Public transport');
    expect(preferences).toHaveTextContent('History, Food');
    expect(preferences).toHaveTextContent('Balanced');
    expect(preferences).toHaveTextContent('Prefer outdoor activities.');
    expect(screen.getByRole('navigation', { name: 'Trip navigation' })).toHaveTextContent('Overview');
    expect(screen.getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page');
  });

  it.each(['/trips/%20invalid%20', '/trips/missing'])('handles invalid and missing IDs at %s', async (path) => {
    const repository = new LocalStorageTripRepository(localStorage);
    const get = vi.spyOn(repository, 'get');
    mount(path, repository);
    await screen.findByRole('heading', { name: 'Trip not found' });
    expect(screen.getByRole('link', { name: 'Back to My Trips' })).toHaveAttribute('href', '/trips');
    expect(screen.queryByRole('complementary', { name: 'Trip context' })).not.toBeInTheDocument();
    if (path.includes('invalid')) expect(get).not.toHaveBeenCalled();
  });

  it('shows loading while the active record is pending', async () => {
    const repository = new LocalStorageTripRepository(localStorage);
    let resolve!: (trip: Trip | null) => void;
    vi.spyOn(repository, 'get').mockImplementation(() => new Promise((done) => { resolve = done; }));
    mount('/trips/rome', repository);
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    await waitFor(() => expect(repository.get).toHaveBeenCalled());
    await act(async () => { resolve(first); });
    await screen.findByRole('heading', { name: 'Rome trip' });
  });

  it('isolates trips and safely displays missing preferences and singular travelers', async () => {
    const router = mount();
    await screen.findByRole('heading', { name: 'Rome trip' });
    await act(async () => { await router.navigate('/trips/vienna'); });
    await screen.findByRole('heading', { name: 'Vienna trip' });
    expect(screen.getByRole('region', { name: 'Trip essentials' })).toHaveTextContent('1 traveler');
    expect(screen.getByRole('region', { name: 'Travel preferences' })).toHaveTextContent('Not specified');
    expect(screen.getByRole('region', { name: 'Total trip budget' })).toHaveTextContent('$800');
    expect(screen.queryByText('Hotel')).not.toBeInTheDocument();
    expect(screen.queryByText('Additional notes')).not.toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Trip context' })).toHaveTextContent('Vienna');
  });

  it('does not let a late load replace the newly selected trip', async () => {
    const repository = new LocalStorageTripRepository(localStorage);
    let resolveFirst!: (trip: Trip | null) => void;
    const originalGet = repository.get.bind(repository);
    vi.spyOn(repository, 'get').mockImplementation((id) => id === 'rome' ? new Promise((resolve) => { resolveFirst = resolve; }) : originalGet(id));
    const router = mount('/trips/rome', repository);
    await waitFor(() => expect(repository.get).toHaveBeenCalledWith('rome'));
    await act(async () => { await router.navigate('/trips/vienna'); });
    await screen.findByRole('heading', { name: 'Vienna trip' });
    await act(async () => { resolveFirst(first); });
    expect(screen.getByRole('heading', { name: 'Vienna trip' })).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Rome trip' })).not.toBeInTheDocument();
  });

  it('retains context during editing and propagates a saved edit to every consumer and reload', async () => {
    const repository = new LocalStorageTripRepository(localStorage);
    const get = vi.spyOn(repository, 'get');
    const router = mount('/trips/rome', repository);
    await screen.findByRole('heading', { name: 'Rome trip' });
    await userEvent.click(screen.getByRole('link', { name: 'Edit trip' }));
    expect(screen.getByRole('complementary', { name: 'Trip context' })).toHaveTextContent('Rome');
    expect(screen.getByLabelText('Destination', { exact: true })).toHaveValue('Rome');
    expect(screen.getByRole('link', { name: 'Overview' })).not.toHaveAttribute('aria-current');
    await userEvent.clear(screen.getByLabelText('Destination', { exact: true }));
    await userEvent.type(screen.getByLabelText('Destination', { exact: true }), 'Rome, Italy');
    await userEvent.selectOptions(screen.getByLabelText('Accommodation'), 'apartment');
    await userEvent.click(screen.getByRole('button', { name: 'Review trip' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await screen.findByRole('heading', { name: 'Rome, Italy trip' });
    await screen.findByRole('region', { name: 'Travel preferences' });
    expect(router.state.location.pathname).toBe('/trips/rome');
    expect(get).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('complementary', { name: 'Trip context' })).toHaveTextContent('Rome, Italy');
    expect(screen.getByRole('region', { name: 'Travel preferences' })).toHaveTextContent('Apartment');
    const persisted = await new LocalStorageTripRepository(localStorage).get('rome');
    expect(persisted?.id).toBe(first.id);
    expect(persisted?.createdAt).toBe(first.createdAt);
    expect((await repository.get('vienna'))?.destination).toBe(second.destination);
    await userEvent.click(within(screen.getByRole('navigation', { name: 'Breadcrumb' })).getByRole('link', { name: 'My Trips' }));
    await screen.findByRole('heading', { name: 'My Trips' });
    expect(screen.getByRole('link', { name: 'Open Rome, Italy trip' })).toHaveAttribute('href', '/trips/rome');
    expect(screen.queryByRole('complementary', { name: 'Trip context' })).not.toBeInTheDocument();
    cleanup();
    mount('/trips/rome');
    await screen.findByRole('heading', { name: 'Rome, Italy trip' });
    expect(screen.getByRole('region', { name: 'Travel preferences' })).toHaveTextContent('Apartment');
  });

  it('keeps global navigation available and removes contextual navigation on global pages', async () => {
    mount();
    await screen.findByRole('heading', { name: 'Rome trip' });
    await userEvent.click(screen.getAllByRole('link', { name: 'Home' })[0]!);
    await screen.findByRole('heading', { name: 'Home' });
    expect(screen.queryByRole('complementary', { name: 'Trip context' })).not.toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('link', { name: 'Plan a Trip' })[0]!);
    await screen.findByRole('heading', { name: 'Create a trip' });
    expect(screen.queryByRole('navigation', { name: 'Trip navigation' })).not.toBeInTheDocument();
  });

  it('offers retry for storage errors and recovers without fabricating a trip', async () => {
    const repository = new LocalStorageTripRepository(localStorage);
    vi.spyOn(repository, 'get').mockRejectedValueOnce(new Error('Saved trips are unavailable in this browser.'));
    mount('/trips/rome', repository);
    await screen.findByRole('heading', { name: 'Unable to open this trip' });
    expect(screen.getByRole('alert')).toHaveTextContent('unavailable');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByRole('heading', { name: 'Rome trip' });
  });

  it('lets healthy trips remain available when a stored record is damaged', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, trips: [first, { id: 'broken', destination: 'Damaged' }] }));
    mount('/trips/broken');
    await screen.findByRole('heading', { name: 'Unable to open this trip' });
    expect(screen.getByRole('alert')).toHaveTextContent('preserved');
    await userEvent.click(screen.getByRole('link', { name: 'Back to My Trips' }));
    await screen.findByRole('heading', { name: 'My Trips' });
    expect(screen.getByRole('link', { name: 'Open Rome trip' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('original data has been preserved');
  });
});
