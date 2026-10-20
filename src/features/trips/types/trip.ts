export const supportedCurrencies = ['EUR', 'USD', 'GBP', 'CHF', 'JPY', 'CAD', 'AUD'] as const;

export type Currency = (typeof supportedCurrencies)[number];
export type TripId = string;

export const accommodationOptions = ['any', 'hotel', 'apartment', 'hostel', 'guesthouse'] as const;
export const transportationOptions = ['walking', 'public_transport', 'car', 'bicycle'] as const;
export const interestOptions = ['history', 'culture', 'museums', 'nature', 'food', 'shopping', 'architecture', 'adventure', 'nightlife', 'relaxation'] as const;
export const paceOptions = ['relaxed', 'balanced', 'active'] as const;
export type TripPreferences = {
  accommodation: (typeof accommodationOptions)[number];
  transportation: (typeof transportationOptions)[number][];
  interests: (typeof interestOptions)[number][];
  pace: (typeof paceOptions)[number];
  notes?: string;
};
export function defaultPreferences(): TripPreferences {
  return { accommodation: 'any', transportation: [], interests: [], pace: 'balanced' };
}

export type Trip = {
  id: TripId;
  title: string;
  origin: string;
  destination: string;
  startDate: string;
  endDate: string;
  travelers: number;
  budget: {
    amount: number;
    currency: Currency;
  };
  createdAt: string;
  updatedAt: string;
  preferences?: TripPreferences;
  itinerary?: GeneratedItinerary;
  destinationResolution?: DestinationResolution;
  selectedStay?: SelectedStay;
  transportSettings?: import('../../transport/domain/routing').TransportSettings;
  budgetLedger?: import('../../budget/domain/model').BudgetLedger;
  longDistanceTravel?: import('../../long-distance-transport/domain/model').LongDistanceTravelPlan;
};

export type CreateTripInput = Pick<Trip, 'origin' | 'destination' | 'startDate' | 'endDate' | 'travelers' | 'budget' | 'preferences'>;
import type { GeneratedItinerary } from '../../itinerary/types/itinerary';
import type { DestinationResolution } from '../validation/destinationSchema';
import type { SelectedStay } from '../../accommodation/domain/accommodation';
