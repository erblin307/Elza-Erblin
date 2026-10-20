import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TripsProvider } from '../../../app/providers/TripsProvider';
import { LocalStorageTripRepository, STORAGE_KEY } from '../services/LocalStorageTripRepository';
import type { Trip } from '../types/trip';
import { TripsPage } from './TripsPage';

const rome: Trip = { id: 'rome', title: 'Rome trip', origin: 'Prishtina', destination: 'Rome', startDate: '2027-06-12', endDate: '2027-06-17', travelers: 2, budget: { amount: 1500, currency: 'EUR' }, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-03-01T00:00:00.000Z' };
const vienna: Trip = { ...rome, id: 'vienna', title: 'Vienna trip', destination: 'Vienna', startDate: '2027-05-02', endDate: '2027-05-05', createdAt: '2026-02-01T00:00:00.000Z', updatedAt: '2026-02-01T00:00:00.000Z' };
const past: Trip = { ...rome, id: 'athens', title: 'Athens memories', destination: 'Athens', startDate: '2025-05-02', endDate: '2025-05-05', updatedAt: '2026-04-01T00:00:00.000Z' };

function mount() {
  render(<MemoryRouter><TripsProvider repository={new LocalStorageTripRepository(localStorage)}><TripsPage /></TripsProvider></MemoryRouter>);
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, trips: [rome, vienna, past] }));
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute('open', ''); } });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute('open'); } });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear(); });

describe('My Trips management', () => {
  it('searches, filters and sorts saved Trips without provider calls', async () => {
    mount();
    await screen.findAllByRole('link', { name: /^Open / });
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search trips' }), 'vienna');
    expect(screen.getByText('Vienna trip')).toBeVisible();
    expect(screen.queryByText('Rome trip')).not.toBeInTheDocument();
    await userEvent.clear(screen.getByRole('searchbox', { name: 'Search trips' }));
    await userEvent.click(screen.getByRole('button', { name: 'Past' }));
    expect(screen.getByText('Athens memories')).toBeVisible();
    expect(screen.queryByText('Vienna trip')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'All' }));
    await userEvent.selectOptions(screen.getByLabelText('Sort by'), 'destination');
    const rows = screen.getAllByRole('article');
    expect(within(rows[0]!).getByText('Athens memories')).toBeVisible();
    expect(within(rows[2]!).getByText('Vienna trip')).toBeVisible();
  });

  it('duplicates independently and deletes only after confirmation', async () => {
    mount(); await screen.findByText('Rome trip');
    await userEvent.click(screen.getByRole('button', { name: 'Duplicate Rome trip' }));
    expect(await screen.findByText('Rome trip (Copy)')).toBeVisible();
    expect((await new LocalStorageTripRepository(localStorage).list()).some((trip) => trip.title === 'Rome trip (Copy)')).toBe(true);
    await userEvent.click(screen.getByRole('button', { name: 'Delete Rome trip (Copy)' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete this trip?' });
    expect(dialog).toHaveTextContent('itinerary, planned stay, transport settings and manual expenses');
    expect(screen.getByText('Rome trip (Copy)')).toBeVisible();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete trip' }));
    expect(await screen.findByText(/and its saved planning data were deleted/)).toBeVisible();
    expect(screen.queryByText('Rome trip (Copy)')).not.toBeInTheDocument();
    expect((await new LocalStorageTripRepository(localStorage).get('rome'))?.title).toBe('Rome trip');
  });

  it('exposes opening and editing by the canonical Trip ID', async () => {
    mount(); await screen.findByText('Rome trip');
    expect(screen.getByRole('link', { name: 'Open Rome trip' })).toHaveAttribute('href', '/trips/rome');
    expect(screen.getByRole('link', { name: 'Edit Rome trip' })).toHaveAttribute('href', '/trips/rome/edit');
  });

  it('refreshes from the authoritative store after another-tab storage event', async () => {
    mount(); await screen.findByText('Rome trip');
    const berlin = { ...rome, id: 'berlin', title: 'Berlin trip', destination: 'Berlin' };
    const value = JSON.stringify({ version: 1, trips: [berlin, rome, vienna, past] });
    localStorage.setItem(STORAGE_KEY, value);
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY, newValue: value }));
    expect(await screen.findByText('Berlin trip')).toBeVisible();
    expect(screen.getByText(/changed in another browser tab/)).toBeVisible();
  });
});
