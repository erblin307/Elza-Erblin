import type { Trip } from '../types/trip';

export type TripBackup = {
  format: 'smart-travel-planner-backup';
  version: 1;
  exportedAt: string;
  trips: Trip[];
};

export function createTripBackup(trips: Trip[], exportedAt = new Date().toISOString()): TripBackup {
  return { format: 'smart-travel-planner-backup', version: 1, exportedAt, trips: structuredClone(trips) };
}
