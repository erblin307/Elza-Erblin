import { z } from 'zod';
import type { CreateTripInput, Trip } from '../types/trip';
import { supportedCurrencies } from '../types/trip';
import type { TripRepository } from './TripRepository';

const STORAGE_KEY = 'smart-travel-planner.trips.v1';

const tripSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  origin: z.string().min(1),
  destination: z.string().min(1),
  startDate: z.string(),
  endDate: z.string(),
  travelers: z.number().int().positive(),
  budget: z.object({ amount: z.number().finite().positive(), currency: z.enum(supportedCurrencies) }),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const storedTripsSchema = z.object({ version: z.literal(1), trips: z.array(tripSchema) });

export class TripStorageError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'TripStorageError';
  }
}

function createId() {
  return globalThis.crypto?.randomUUID?.() ?? `trip-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export class LocalStorageTripRepository implements TripRepository {
  constructor(private readonly storage: Storage = window.localStorage) {}

  async list(): Promise<Trip[]> {
    return this.read().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async get(id: string): Promise<Trip | null> {
    return this.read().find((trip) => trip.id === id) ?? null;
  }

  async create(input: CreateTripInput): Promise<Trip> {
    const now = new Date().toISOString();
    const trip: Trip = {
      ...input,
      id: createId(),
      title: `${input.destination} trip`,
      createdAt: now,
      updatedAt: now,
    };
    const trips = this.read();
    this.write([trip, ...trips]);
    return trip;
  }

  async delete(id: string): Promise<void> {
    const trips = this.read();
    this.write(trips.filter((trip) => trip.id !== id));
  }

  private read(): Trip[] {
    let raw: string | null;
    try {
      raw = this.storage.getItem(STORAGE_KEY);
    } catch (error) {
      throw new TripStorageError('Saved trips are unavailable in this browser.', { cause: error });
    }
    if (raw === null) return [];
    try {
      const result = storedTripsSchema.safeParse(JSON.parse(raw));
      if (!result.success) throw new Error('Stored data does not match the supported format.');
      return result.data.trips;
    } catch (error) {
      throw new TripStorageError('Saved trip data could not be read safely.', { cause: error });
    }
  }

  private write(trips: Trip[]) {
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, trips }));
    } catch (error) {
      throw new TripStorageError('Your changes could not be saved in this browser.', { cause: error });
    }
  }
}

export { STORAGE_KEY };
