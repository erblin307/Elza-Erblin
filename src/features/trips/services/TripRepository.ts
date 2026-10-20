import type { CreateTripInput, Trip } from '../types/trip';
import type { GeneratedItinerary } from '../../itinerary/types/itinerary';
import type { DestinationResolution } from '../validation/destinationSchema';
import type { SelectedStay } from '../../accommodation/domain/accommodation';
import type { BudgetLedger } from '../../budget/domain/model';
import type { LongDistanceTravelPlan } from '../../long-distance-transport/domain/model';

export interface TripRepository {
  list(): Promise<Trip[]>;
  get(id: string): Promise<Trip | null>;
  create(input: CreateTripInput): Promise<Trip>;
  update(id: string, input: CreateTripInput, expectedUpdatedAt?: string): Promise<Trip>;
  duplicate(id: string): Promise<Trip>;
  delete(id: string): Promise<void>;
  saveItinerary(id: string, itinerary: GeneratedItinerary, expectedUpdatedAt?: string): Promise<Trip>;
  saveDestination(id: string, resolution: DestinationResolution, expectedUpdatedAt?: string): Promise<Trip>;
  saveStay(id: string, stay: SelectedStay | null, expectedUpdatedAt?: string): Promise<Trip>;
  saveTransportSettings(id: string, settings: import('../../transport/domain/routing').TransportSettings, expectedUpdatedAt?: string): Promise<Trip>;
  saveBudgetLedger(id: string, ledger: BudgetLedger, expectedUpdatedAt?: string): Promise<Trip>;
  saveLongDistanceTravel(id: string, plan: LongDistanceTravelPlan, expectedUpdatedAt?: string): Promise<Trip>;
  getStayWarning?(id: string): string | null;
  getBudgetWarning?(id: string): string | null;
  getLongDistanceTravelWarning?(id: string): string | null;
  getReadWarning?(): string | null;
  getItineraryWarning?(id: string): string | null;
}
