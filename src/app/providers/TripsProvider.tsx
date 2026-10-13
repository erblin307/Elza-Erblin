import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { CreateTripInput, Trip } from '../../features/trips/types/trip';
import { LocalStorageTripRepository } from '../../features/trips/services/LocalStorageTripRepository';
import type { TripRepository } from '../../features/trips/services/TripRepository';

type TripsContextValue = {
  trips: Trip[];
  isLoading: boolean;
  error: string | null;
  createTrip: (input: CreateTripInput) => Promise<Trip>;
  deleteTrip: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
};

const TripsContext = createContext<TripsContextValue | null>(null);
const defaultRepository = new LocalStorageTripRepository();

export function TripsProvider({ children, repository = defaultRepository }: { children: ReactNode; repository?: TripRepository }) {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      setTrips(await repository.list());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Trips could not be loaded.');
    } finally {
      setIsLoading(false);
    }
  }, [repository]);

  useEffect(() => {
    let active = true;
    repository.list().then(
      (savedTrips) => {
        if (!active) return;
        setError(null);
        setTrips(savedTrips);
      },
      (cause: unknown) => {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : 'Trips could not be loaded.');
      },
    ).finally(() => {
      if (active) setIsLoading(false);
    });
    return () => { active = false; };
  }, [repository]);

  const createTrip = useCallback(async (input: CreateTripInput) => {
    try {
      setError(null);
      const trip = await repository.create(input);
      setTrips((current) => [trip, ...current]);
      return trip;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'The trip could not be saved.';
      setError(message);
      throw cause;
    }
  }, [repository]);

  const deleteTrip = useCallback(async (id: string) => {
    try {
      setError(null);
      await repository.delete(id);
      setTrips((current) => current.filter((trip) => trip.id !== id));
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'The trip could not be deleted.';
      setError(message);
      throw cause;
    }
  }, [repository]);

  const value = useMemo(() => ({ trips, isLoading, error, createTrip, deleteTrip, refresh }), [trips, isLoading, error, createTrip, deleteTrip, refresh]);
  return <TripsContext.Provider value={value}>{children}</TripsContext.Provider>;
}

export function useTrips() {
  const context = useContext(TripsContext);
  if (!context) throw new Error('useTrips must be used inside TripsProvider.');
  return context;
}
