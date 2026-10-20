import type { SelectedStay } from '../domain/accommodation';

// Extension contract only: no commercial adapter, credentials or offers are installed.
export type InventoryRequest = { providerPropertyId: string; checkIn: string; checkOut: string; rooms: { adults: number; childAges: number[] }[]; currency: string };
export type AccommodationOffer = {
  id: string; provider: string; providerPropertyId: string; request: InventoryRequest;
  verifiedAt: string; expiresAt: string; availability: 'available' | 'unavailable';
  total?: { amount: number; currency: string; includesMandatoryCharges: boolean };
};
export interface AccommodationInventoryProvider {
  searchAvailable(request: InventoryRequest, signal?: AbortSignal): Promise<AccommodationOffer[]>;
}
export type AccommodationCost = { status: 'unknown'; reason: string; propertyId?: string; checkIn?: string; checkOut?: string };
export function accommodationCost(stay?: SelectedStay): AccommodationCost {
  return { status: 'unknown', reason: 'No verified accommodation offer is attached.', propertyId: stay?.property.id, checkIn: stay?.checkIn, checkOut: stay?.checkOut };
}
