import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appRoutes } from '../../../app/routes';
import { ThemeProvider } from '../../../app/providers/ThemeProvider';
import { TripsProvider } from '../../../app/providers/TripsProvider';
import { LocalStorageTripRepository, STORAGE_KEY } from '../../trips/services/LocalStorageTripRepository';
import type { Trip } from '../../trips/types/trip';
import { formatDate } from '../../trips/utils/tripFormatters';
import * as generation from '../services/itineraryGenerator';
import { generateItinerary } from '../domain/generator';
import { editItinerary } from '../domain/editing';
import type { GeneratedItinerary } from '../types/itinerary';
import { candidatePool, generationOptions, testTrip } from './testData';

const uiTrip: Trip = { ...testTrip, endDate: '2027-06-17' };
const secondTrip: Trip = { ...uiTrip, id: 'second-trip', title: 'Vienna trip', destination: 'Vienna' };

function mount(path = '/trips/test-trip/itinerary', repository = new LocalStorageTripRepository(localStorage)) {
  const router = createMemoryRouter(appRoutes, { initialEntries: [path] });
  render(<ThemeProvider><TripsProvider repository={repository}><RouterProvider router={router} /></TripsProvider></ThemeProvider>);
  return router;
}
async function generateDemo() {
  await screen.findByRole('heading', { name: 'Itinerary' });
  await userEvent.selectOptions(screen.getByLabelText('Activity data source'), 'demo');
  await userEvent.click(screen.getByRole('button', { name: 'Generate itinerary' }));
  await screen.findByText('Demonstration itinerary');
}
beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, trips: [uiTrip, secondTrip] }));
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function(this: HTMLDialogElement) { this.setAttribute('open', ''); } });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function(this: HTMLDialogElement) { this.removeAttribute('open'); } });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('Itinerary workspace workflow', () => {
  it('starts empty and reports unavailable live data without saving invented activities', async () => {
    mount();
    await screen.findByRole('heading', { name: 'Build your itinerary' });
    await userEvent.click(screen.getByRole('button', { name: 'Generate itinerary' }));
    await screen.findByText('No activity data available for this destination.');
    expect((await new LocalStorageTripRepository(localStorage).get(uiTrip.id))?.itinerary).toBeUndefined();
  });
  it('generates disclosed sample data with six dates and navigable ordered activities', async () => {
    mount(); await generateDemo();
    const navigation = screen.getByRole('navigation', { name: 'Itinerary days' });
    expect(within(navigation).getAllByRole('button')).toHaveLength(6);
    expect(screen.getByText(/All times are suggested/)).toBeVisible();
    expect(screen.getByText(/Costs are synthetic planning inputs/)).toBeVisible();
    await userEvent.click(within(navigation).getByRole('button', { name: 'Day 6' }));
    expect(screen.getByRole('region', { name: 'Day 6 schedule' })).toHaveTextContent(formatDate(uiTrip.endDate, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
    const saved = (await new LocalStorageTripRepository(localStorage).get(uiTrip.id))?.itinerary;
    expect(saved?.metadata.dataMode).toBe('demo');
    expect(saved?.days).toHaveLength(6);
  });
  it('opens truthful activity details without fabricated venue information', async () => {
    mount(); await generateDemo();
    await userEvent.click(screen.getAllByRole('button', { name: /^Details for/ })[0]!);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('Coordinates not supplied.');
    expect(dialog).toHaveTextContent('Opening hours not verified.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Close details' }));
  });
  it('removes and moves actual occurrences, then reloads persisted changes', async () => {
    mount(); await generateDemo();
    const repository = new LocalStorageTripRepository(localStorage);
    const initial = (await repository.get(uiTrip.id))!.itinerary!;
    const day = screen.getByRole('region', { name: 'Day 1 schedule' });
    const firstRow = within(day).getAllByRole('listitem')[0]!;
    await userEvent.click(within(firstRow).getByText('Actions', { exact: true }));
    await userEvent.click(within(firstRow).getByRole('button', { name: 'Remove activity' }));
    await waitFor(async () => expect((await repository.get(uiTrip.id))!.itinerary!.days[0]!.items).toHaveLength(1));
    const remainingRow = within(screen.getByRole('region', { name: 'Day 1 schedule' })).getAllByRole('listitem')[0]!;
    const afterRemoval = (await repository.get(uiTrip.id))!.itinerary!;
    const itemId = afterRemoval.days[0]!.items[0]!.id;
    const target = afterRemoval.days.slice(1).find((destination) => {
      try { editItinerary(afterRemoval, { type: 'move', itemId, dayId: destination.id }); return true; }
      catch { return false; }
    });
    expect(target).toBeDefined();
    await userEvent.click(within(remainingRow).getByText('Actions', { exact: true }));
    await userEvent.selectOptions(within(remainingRow).getByLabelText('Destination day for activity 1'), target!.id);
    await userEvent.click(within(remainingRow).getByRole('button', { name: 'Move activity' }));
    await waitFor(async () => expect((await repository.get(uiTrip.id))!.itinerary!.days[0]!.items).toHaveLength(0));
    const changed = (await repository.get(uiTrip.id))!.itinerary!;
    expect(changed.days.find((destination) => destination.id === target!.id)!.items.length).toBe(initial.days.find((destination) => destination.id === target!.id)!.items.length + 1);
    cleanup(); mount();
    await screen.findByText('Demonstration itinerary');
    expect(screen.getByRole('region', { name: 'Day 1 schedule' })).toHaveTextContent('No activities planned');
    expect((await repository.get(secondTrip.id))?.itinerary).toBeUndefined();
  });
  it('requires regeneration confirmation and retains manual work when canceled', async () => {
    mount(); await generateDemo();
    const repository = new LocalStorageTripRepository(localStorage);
    const before = (await repository.get(uiTrip.id))!.itinerary;
    await userEvent.click(screen.getByRole('button', { name: 'Regenerate itinerary' }));
    const dialog = screen.getByRole('dialog', { name: 'Generate a new plan?' });
    expect(dialog).toHaveTextContent('manual changes');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect((await repository.get(uiTrip.id))!.itinerary).toEqual(before);
    await userEvent.click(screen.getByRole('button', { name: 'Regenerate itinerary' }));
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Generate a new plan?' })).getByRole('button', { name: 'Regenerate' }));
    await screen.findByText('Demonstration itinerary');
  });
  it('prevents duplicate generation requests while an actual operation is pending', async () => {
    let resolve!: (itinerary: GeneratedItinerary) => void;
    const generate = vi.spyOn(generation, 'generateTripItinerary').mockImplementation(() => new Promise((done) => { resolve = done; }));
    mount(); await screen.findByRole('heading', { name: 'Build your itinerary' });
    const button = screen.getByRole('button', { name: 'Generate itinerary' });
    fireEvent.click(button); fireEvent.click(button);
    expect(generate).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Generating…' })).toBeDisabled();
    await act(async () => { resolve(generateItinerary(uiTrip, candidatePool(), generationOptions)); });
    await screen.findByText('Suggested itinerary');
  });
  it('preserves the current plan if candidate retrieval fails during regeneration', async () => {
    mount(); await generateDemo();
    const repository = new LocalStorageTripRepository(localStorage);
    const before = (await repository.get(uiTrip.id))!.itinerary;
    vi.spyOn(generation, 'generateTripItinerary').mockRejectedValue(new Error('Candidate provider is unavailable.'));
    await userEvent.click(screen.getByRole('button', { name: 'Regenerate itinerary' }));
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Generate a new plan?' })).getByRole('button', { name: 'Regenerate' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('unavailable');
    expect((await repository.get(uiTrip.id))!.itinerary).toEqual(before);
  });
  it('flags trip preference changes and keeps both trips isolated', async () => {
    const router = mount(); await generateDemo();
    await userEvent.click(screen.getByRole('link', { name: 'Edit trip' }));
    await userEvent.click(screen.getByRole('radio', { name: /Active/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Review trip' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await screen.findByRole('region', { name: 'Travel preferences' });
    await userEvent.click(screen.getByRole('link', { name: 'Itinerary' }));
    expect(await screen.findByText('Trip preferences changed.')).toBeVisible();
    await act(async () => { await router.navigate('/trips/second-trip/itinerary'); });
    await screen.findByRole('heading', { name: 'Build your itinerary' });
    expect(screen.queryByText('Demonstration itinerary')).not.toBeInTheDocument();
    await generateDemo();
    const repository = new LocalStorageTripRepository(localStorage);
    expect((await repository.get(uiTrip.id))?.itinerary?.context.destination).toBe('rome');
    expect((await repository.get(secondTrip.id))?.itinerary?.context.destination).toBe('vienna');
  });
});
