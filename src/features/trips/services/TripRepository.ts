import type { CreateTripInput, Trip } from '../types/trip';

export interface TripRepository {
  list(): Promise<Trip[]>;
  get(id: string): Promise<Trip | null>;
  create(input: CreateTripInput): Promise<Trip>;
  delete(id: string): Promise<void>;
}
