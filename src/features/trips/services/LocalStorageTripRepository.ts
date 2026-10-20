import { z } from 'zod';
import type { CreateTripInput, Trip } from '../types/trip';
import { createTripSchema, storedTripSchema } from '../validation/tripSchema';
import type { TripRepository } from './TripRepository';
import { itinerarySchema } from '../../itinerary/domain/validation';
import { isItineraryStale } from '../../itinerary/domain/context';
import type { GeneratedItinerary } from '../../itinerary/types/itinerary';
import { destinationResolutionSchema, type DestinationResolution } from '../validation/destinationSchema';
import { canonicalDestination } from '../../../shared/validation/location';
import { selectedStaySchema, stayNeedsReview, type SelectedStay } from '../../accommodation/domain/accommodation';
import { transportSettingsSchema, type TransportSettings } from '../../transport/domain/routing';
import { budgetLedgerSchema, type BudgetLedger } from '../../budget/domain/model';
import { copyTitle, duplicateTrip } from '../domain/duplicateTrip';
import { longDistanceTravelPlanSchema, type LongDistanceTravelPlan } from '../../long-distance-transport/domain/model';

const STORAGE_KEY = 'smart-travel-planner.trips.v1';
const STORE_VERSION = 1;

const storedTripsSchema = z.object({ version: z.literal(STORE_VERSION), trips: z.array(z.unknown()) });
const legacyTripsSchema = z.union([
  z.array(z.unknown()),
  z.object({ schemaVersion: z.literal(1), trips: z.array(z.unknown()) }),
]);

type StorageSnapshot = { records: unknown[]; validTrips: Trip[]; migrated: boolean };

function recordId(record: unknown): unknown {
  return typeof record === 'object' && record !== null && 'id' in record ? record.id : undefined;
}

function recordFields(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export class TripStorageError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'TripStorageError';
  }
}

function createId() {
  return globalThis.crypto?.randomUUID?.() ?? `trip-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function uniqueId(records: unknown[]) {
  const existing = new Set(records.map(recordId));
  for (let attempt = 0; attempt < 20; attempt++) {
    const id = createId();
    if (!existing.has(id)) return id;
  }
  throw new TripStorageError('A unique Trip ID could not be created. Please try again.');
}

function assertCurrent(existing: Trip, expectedUpdatedAt?: string) {
  if (expectedUpdatedAt && existing.updatedAt !== expectedUpdatedAt) throw new TripStorageError('This trip changed in another browser tab. Review the latest saved version and try again.');
}

function nextUpdatedAt(existing: Trip) {
  const now = Date.now();
  const previous = Date.parse(existing.updatedAt);
  return new Date(Number.isFinite(previous) && now <= previous ? previous + 1 : now).toISOString();
}

function storedRecords(raw: string) {
  const parsed: unknown = JSON.parse(raw);
  const current = storedTripsSchema.safeParse(parsed);
  if (current.success) return { records: current.data.trips, migrated: false };
  const legacy = legacyTripsSchema.safeParse(parsed);
  if (legacy.success) return { records: Array.isArray(legacy.data) ? legacy.data : legacy.data.trips, migrated: true };
  throw new Error('Stored data does not match the supported format.');
}

export class LocalStorageTripRepository implements TripRepository {
  private readWarning: string | null = null;
  private itineraryWarnings = new Map<string, string>();
  private stayWarnings = new Map<string, string>();
  private budgetWarnings = new Map<string, string>();
  private longDistanceTravelWarnings = new Map<string, string>();
  constructor(private readonly storage?: Storage) {}

  getReadWarning() { return this.readWarning; }
  getItineraryWarning(id: string) { return this.itineraryWarnings.get(id) ?? null; }
  getStayWarning(id: string) { return this.stayWarnings.get(id) ?? null; }
  getBudgetWarning(id: string) { return this.budgetWarnings.get(id) ?? null; }
  getLongDistanceTravelWarning(id: string) { return this.longDistanceTravelWarnings.get(id) ?? null; }

  async list(): Promise<Trip[]> {
    return this.read().validTrips.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async get(id: string): Promise<Trip | null> {
    const snapshot = this.read();
    const trip = snapshot.validTrips.find((trip) => trip.id === id);
    if (!trip && snapshot.records.some((record) => recordId(record) === id)) {
      throw new TripStorageError('This saved trip could not be read safely. Its stored data has been preserved.');
    }
    return trip ?? null;
  }

  async create(input: CreateTripInput): Promise<Trip> {
    const normalized = createTripSchema.parse(input);
    const now = new Date().toISOString();
    const snapshot = this.read();
    const trip: Trip = {
      ...normalized,
      id: uniqueId(snapshot.records),
      title: `${normalized.destination} trip`,
      createdAt: now,
      updatedAt: now,
    };
    this.write([trip, ...snapshot.records]);
    return trip;
  }

  async update(id: string, input: CreateTripInput, expectedUpdatedAt?: string): Promise<Trip> {
    const normalized = createTripSchema.parse(input);
    const snapshot = this.read();
    const existing = snapshot.validTrips.find((trip) => trip.id === id);
    if (!existing) throw new Error('This trip no longer exists.');
    assertCurrent(existing, expectedUpdatedAt);
    const current = createTripSchema.safeParse(existing);
    if (current.success && JSON.stringify(current.data) === JSON.stringify(normalized)) return existing;
    const updated: Trip = {
      ...existing, ...normalized,
      destinationResolution: canonicalDestination(existing.destination) === canonicalDestination(normalized.destination) ? existing.destinationResolution : undefined,
      title: existing.title === `${existing.destination} trip` ? `${normalized.destination} trip` : existing.title,
      updatedAt: nextUpdatedAt(existing),
    };
    this.write(snapshot.records.map((record) => {
      if (recordId(record) !== id) return record;
      const original = recordFields(record);
      return {
        ...original, ...updated,
        destinationResolution: canonicalDestination(existing.destination) === canonicalDestination(normalized.destination) ? original.destinationResolution : undefined,
        budget: { ...recordFields(original.budget), ...updated.budget },
        preferences: { ...recordFields(original.preferences), ...updated.preferences },
      };
    }));
    return updated;
  }

  async duplicate(id: string): Promise<Trip> {
    const snapshot = this.read();
    const existing = snapshot.validTrips.find((trip) => trip.id === id);
    if (!existing) throw new Error('This trip no longer exists.');
    const now = new Date().toISOString();
    const copy = duplicateTrip(existing, uniqueId(snapshot.records), copyTitle(existing.title, snapshot.validTrips.map((trip) => trip.title)), now);
    storedTripSchema.parse(copy);
    if (copy.itinerary) itinerarySchema.parse(copy.itinerary);
    if (copy.selectedStay) selectedStaySchema.parse(copy.selectedStay);
    if (copy.transportSettings) transportSettingsSchema.parse(copy.transportSettings);
    if (copy.budgetLedger) budgetLedgerSchema.parse(copy.budgetLedger);
    if (copy.longDistanceTravel) longDistanceTravelPlanSchema.parse(copy.longDistanceTravel);
    this.write([copy, ...snapshot.records]);
    return copy;
  }

  async delete(id: string): Promise<void> {
    const snapshot = this.read();
    if (!snapshot.validTrips.some((trip) => trip.id === id)) return;
    this.write(snapshot.records.filter((record) => recordId(record) !== id));
  }

  async saveItinerary(id: string, input: GeneratedItinerary, expectedUpdatedAt?: string): Promise<Trip> {
    const itinerary = itinerarySchema.parse(input);
    const snapshot = this.read();
    const existing = snapshot.validTrips.find((trip) => trip.id === id);
    if (!existing) throw new Error('This trip no longer exists.');
    assertCurrent(existing, expectedUpdatedAt);
    if (itinerary.tripId !== id || isItineraryStale(existing, itinerary)) throw new Error('Trip preferences changed. Regenerate from the latest trip details before saving.');
    if (JSON.stringify(existing.itinerary) === JSON.stringify(itinerary)) return existing;
    const updated: Trip = { ...existing, itinerary, updatedAt: nextUpdatedAt(existing) };
    this.write(snapshot.records.map((record) => recordId(record) === id ? { ...recordFields(record), itinerary, updatedAt: updated.updatedAt } : record));
    this.itineraryWarnings.delete(id);
    return updated;
  }

  async saveDestination(id: string, input: DestinationResolution, expectedUpdatedAt?: string): Promise<Trip> {
    const resolution = destinationResolutionSchema.parse(input);
    const snapshot = this.read(); const existing = snapshot.validTrips.find((trip) => trip.id === id);
    if (!existing || canonicalDestination(resolution.destinationLabel) !== canonicalDestination(existing.destination)) throw new Error('The destination changed. Resolve the current trip destination again.');
    assertCurrent(existing, expectedUpdatedAt);
    const updated = { ...existing, destinationResolution: resolution, updatedAt: nextUpdatedAt(existing) };
    this.write(snapshot.records.map((record) => recordId(record) === id ? { ...recordFields(record), destinationResolution: resolution, updatedAt: updated.updatedAt } : record));
    return updated;
  }

  async saveStay(id: string, input: SelectedStay | null, expectedUpdatedAt?: string): Promise<Trip> {
    const stay = input === null ? undefined : selectedStaySchema.parse(input);
    const snapshot = this.read(); const existing = snapshot.validTrips.find((trip) => trip.id === id);
    if (!existing) throw new Error('This trip no longer exists.');
    assertCurrent(existing, expectedUpdatedAt);
    if (stay && stayNeedsReview(existing, stay)) throw new Error('Trip details changed. Review the current destination, dates and travelers before selecting this stay.');
    if (stay && JSON.stringify(existing.selectedStay) === JSON.stringify(stay)) return existing;
    const updated = { ...existing, selectedStay: stay, updatedAt: nextUpdatedAt(existing) };
    this.write(snapshot.records.map((record) => recordId(record) === id ? { ...recordFields(record), selectedStay: stay, updatedAt: updated.updatedAt } : record));
    this.stayWarnings.delete(id);
    return updated;
  }

  async saveTransportSettings(id: string, input: TransportSettings, expectedUpdatedAt?: string): Promise<Trip> {
    const settings = transportSettingsSchema.parse(input);
    const snapshot = this.read(); const existing = snapshot.validTrips.find((trip) => trip.id === id);
    if (!existing) throw new Error('This trip no longer exists.');
    assertCurrent(existing, expectedUpdatedAt);
    const updated = { ...existing, transportSettings: settings, updatedAt: nextUpdatedAt(existing) };
    this.write(snapshot.records.map((record) => recordId(record) === id ? { ...recordFields(record), transportSettings: settings, updatedAt: updated.updatedAt } : record));
    return updated;
  }

  async saveBudgetLedger(id: string, input: BudgetLedger, expectedUpdatedAt?: string): Promise<Trip> {
    const ledger = budgetLedgerSchema.parse(input);
    const snapshot = this.read(); const existing = snapshot.validTrips.find((trip) => trip.id === id);
    if (!existing) throw new Error('This trip no longer exists.');
    assertCurrent(existing, expectedUpdatedAt);
    if (ledger.expenses.some((expense) => expense.tripId !== id)) throw new Error('An expense belongs to another trip.');
    if (JSON.stringify(existing.budgetLedger) === JSON.stringify(ledger)) return existing;
    const updated = { ...existing, budgetLedger: ledger, updatedAt: nextUpdatedAt(existing) };
    this.write(snapshot.records.map((record) => recordId(record) === id ? { ...recordFields(record), budgetLedger: ledger, updatedAt: updated.updatedAt } : record));
    this.budgetWarnings.delete(id);
    return updated;
  }

  async saveLongDistanceTravel(id: string, input: LongDistanceTravelPlan, expectedUpdatedAt?: string): Promise<Trip> {
    const plan = longDistanceTravelPlanSchema.parse(input);
    const snapshot = this.read(); const existing = snapshot.validTrips.find((trip) => trip.id === id);
    if (!existing) throw new Error('This trip no longer exists.');
    assertCurrent(existing, expectedUpdatedAt);
    if (plan.journeys.some((journey) => journey.tripId !== id)) throw new Error('A journey belongs to another trip.');
    if (JSON.stringify(existing.longDistanceTravel) === JSON.stringify(plan)) return existing;
    const updated: Trip = { ...existing, longDistanceTravel: plan, updatedAt: nextUpdatedAt(existing) };
    this.write(snapshot.records.map((record) => recordId(record) === id ? { ...recordFields(record), longDistanceTravel: plan, updatedAt: updated.updatedAt } : record));
    this.longDistanceTravelWarnings.delete(id);
    return updated;
  }

  private read(): StorageSnapshot {
    let raw: string | null;
    try {
      raw = (this.storage ?? window.localStorage).getItem(STORAGE_KEY);
    } catch (error) {
      throw new TripStorageError('Saved trips are unavailable in this browser.', { cause: error });
    }
    if (raw === null) { this.readWarning = null; this.itineraryWarnings.clear(); this.stayWarnings.clear(); this.budgetWarnings.clear(); this.longDistanceTravelWarnings.clear(); return { records: [], validTrips: [], migrated: false }; }
    try {
      const parsedStore = storedRecords(raw);
      const records = parsedStore.records;
      const idCounts = new Map<unknown, number>();
      for (const record of records) idCounts.set(recordId(record), (idCounts.get(recordId(record)) ?? 0) + 1);
      const validTrips: Trip[] = [];
      this.itineraryWarnings.clear();
      this.stayWarnings.clear();
      this.budgetWarnings.clear();
      this.longDistanceTravelWarnings.clear();
      for (const record of records) {
        const parsed = storedTripSchema.safeParse(record);
        if (parsed.success && idCounts.get(parsed.data.id) === 1) {
          const rawItinerary = recordFields(record).itinerary;
          const trip: Trip = parsed.data;
          const transport = transportSettingsSchema.safeParse(recordFields(record).transportSettings);
          if (transport.success) trip.transportSettings = transport.data;
          const resolved = destinationResolutionSchema.safeParse(recordFields(record).destinationResolution);
          if (resolved.success && canonicalDestination(resolved.data.destinationLabel) === canonicalDestination(trip.destination)) trip.destinationResolution = resolved.data;
          const rawStay = recordFields(record).selectedStay;
          if (rawStay !== undefined) {
            const savedStay = selectedStaySchema.safeParse(rawStay);
            if (savedStay.success && savedStay.data.tripId === trip.id) trip.selectedStay = savedStay.data;
            else this.stayWarnings.set(trip.id, 'The saved accommodation could not be read safely. Its original data is preserved; select a replacement or clear it explicitly.');
          }
          const rawBudgetLedger = recordFields(record).budgetLedger;
          if (rawBudgetLedger !== undefined) {
            const savedBudget = budgetLedgerSchema.safeParse(rawBudgetLedger);
            if (savedBudget.success && savedBudget.data.expenses.every((expense) => expense.tripId === trip.id)) trip.budgetLedger = savedBudget.data;
            else this.budgetWarnings.set(trip.id, 'The saved expense ledger could not be read safely. Its original data is preserved; replace it only through an explicit budget change.');
          }
          const rawLongDistanceTravel = recordFields(record).longDistanceTravel;
          if (rawLongDistanceTravel !== undefined) {
            const savedTravel = longDistanceTravelPlanSchema.safeParse(rawLongDistanceTravel);
            if (savedTravel.success && savedTravel.data.journeys.every((journey) => journey.tripId === trip.id)) trip.longDistanceTravel = savedTravel.data;
            else this.longDistanceTravelWarnings.set(trip.id, 'The saved long-distance travel plan could not be read safely. Its original data is preserved; replace it only through an explicit travel change.');
          }
          if (rawItinerary !== undefined) {
            const saved = itinerarySchema.safeParse(rawItinerary);
            if (saved.success && saved.data.tripId === trip.id) trip.itinerary = saved.data;
            else this.itineraryWarnings.set(trip.id, 'This saved itinerary could not be read safely. The original data is preserved. Generating a replacement requires confirmation.');
          }
          validTrips.push(trip);
        }
      }
      const unreadableCount = records.length - validTrips.length;
      const warnings: string[] = [];
      if (parsedStore.migrated) warnings.push('An older saved-trip format loaded safely and will be upgraded with the next successful change.');
      if (unreadableCount) warnings.push(`${unreadableCount} saved ${unreadableCount === 1 ? 'trip could' : 'trips could'} not be read. The original data has been preserved; other trips are available.`);
      if (this.itineraryWarnings.size) warnings.push(`${this.itineraryWarnings.size} saved ${this.itineraryWarnings.size === 1 ? 'itinerary needs' : 'itineraries need'} recovery. Trip details and original itinerary data are preserved.`);
      if (this.stayWarnings.size) warnings.push(`${this.stayWarnings.size} saved accommodation selections need recovery. Original data is preserved.`);
      if (this.budgetWarnings.size) warnings.push(`${this.budgetWarnings.size} saved expense ${this.budgetWarnings.size === 1 ? 'ledger needs' : 'ledgers need'} recovery. Original data is preserved.`);
      if (this.longDistanceTravelWarnings.size) warnings.push(`${this.longDistanceTravelWarnings.size} saved long-distance travel ${this.longDistanceTravelWarnings.size === 1 ? 'plan needs' : 'plans need'} recovery. Original data is preserved.`);
      this.readWarning = warnings.join(' ') || null;
      return { records, validTrips, migrated: parsedStore.migrated };
    } catch (error) {
      throw new TripStorageError('Saved trip data could not be read safely.', { cause: error });
    }
  }

  private write(trips: unknown[]) {
    try {
      (this.storage ?? window.localStorage).setItem(STORAGE_KEY, JSON.stringify({ version: STORE_VERSION, trips }));
    } catch (error) {
      const quota = error instanceof DOMException && (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED');
      throw new TripStorageError(quota ? 'Browser storage is full. Export a backup or remove an older trip, then try again.' : 'Your changes could not be saved in this browser.', { cause: error });
    }
  }
}

export { STORAGE_KEY, STORE_VERSION };
