import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { CreateTripInput, Trip } from '../../features/trips/types/trip';
import { LocalStorageTripRepository, STORAGE_KEY } from '../../features/trips/services/LocalStorageTripRepository';
import type { TripRepository } from '../../features/trips/services/TripRepository';
import type { GeneratedItinerary } from '../../features/itinerary/types/itinerary';
import type { DestinationResolution } from '../../features/trips/validation/destinationSchema';
import type { SelectedStay } from '../../features/accommodation/domain/accommodation';
import type { BudgetLedger } from '../../features/budget/domain/model';
import { createTripBackup, type TripBackup } from '../../features/trips/domain/backup';
import type { LongDistanceTravelPlan } from '../../features/long-distance-transport/domain/model';
import { AssistantOrchestrator } from '../../features/assistant/services/orchestrator';

type TripsContextValue = {
  assistant: AssistantOrchestrator;
  trips: Trip[];
  isLoading: boolean;
  error: string | null;
  readWarning: string | null;
  syncNotice: string | null;
  loadTrip: (id: string) => Promise<Trip | null>;
  createTrip: (input: CreateTripInput) => Promise<Trip>;
  updateTrip: (id: string, input: CreateTripInput, expectedUpdatedAt?: string) => Promise<Trip>;
  duplicateTrip: (id: string) => Promise<Trip>;
  deleteTrip: (id: string) => Promise<void>;
  exportTrips: () => TripBackup;
  saveItinerary: (id: string, itinerary: GeneratedItinerary) => Promise<Trip>;
  saveDestination: (id: string, resolution: DestinationResolution) => Promise<Trip>;
  saveStay: (id: string, stay: SelectedStay | null) => Promise<Trip>;
  saveTransportSettings: (id: string, settings: import('../../features/transport/domain/routing').TransportSettings) => Promise<Trip>;
  saveBudgetLedger: (id: string, ledger: BudgetLedger) => Promise<Trip>;
  saveLongDistanceTravel: (id: string, plan: LongDistanceTravelPlan) => Promise<Trip>;
  getStayWarning: (id: string) => string | null;
  getItineraryWarning: (id: string) => string | null;
  getBudgetWarning: (id: string) => string | null;
  getLongDistanceTravelWarning: (id: string) => string | null;
  refresh: () => Promise<void>;
};

const TripsContext = createContext<TripsContextValue | null>(null);
const defaultRepository = new LocalStorageTripRepository();

export function TripsProvider({ children, repository = defaultRepository }: { children: ReactNode; repository?: TripRepository }) {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [readWarning, setReadWarning] = useState<string | null>(null);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const pendingReads = useRef(new Map<string, Promise<Trip | null>>());
  const tripsRef = useRef<Trip[]>([]);

  const replaceAll = useCallback((next: Trip[]) => { tripsRef.current = next; setTrips(next); }, []);
  const replaceOne = useCallback((updated: Trip) => {
    setTrips((current) => {
      const next = current.map((trip) => trip.id === updated.id ? updated : trip).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      tripsRef.current = next;
      return next;
    });
  }, []);
  const revisionFor = useCallback((id: string) => tripsRef.current.find((trip) => trip.id === id)?.updatedAt, []);
  const assistant = useMemo(() => new AssistantOrchestrator(repository, replaceOne), [repository, replaceOne]);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      replaceAll(await repository.list());
      setReadWarning(repository.getReadWarning?.() ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Trips could not be loaded.');
    } finally {
      setIsLoading(false);
    }
  }, [repository, replaceAll]);

  useEffect(() => {
    let active = true;
    repository.list().then(
      (savedTrips) => {
        if (!active) return;
        setError(null);
        replaceAll(savedTrips);
        setReadWarning(repository.getReadWarning?.() ?? null);
      },
      (cause: unknown) => {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : 'Trips could not be loaded.');
      },
    ).finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [repository, replaceAll]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== null && event.key !== STORAGE_KEY) return;
      setSyncNotice('Saved trips changed in another browser tab. The latest persisted version is now shown.');
      void refresh();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [refresh]);

  const createTrip = useCallback(async (input: CreateTripInput) => {
    try {
      setError(null);
      const trip = await repository.create(input);
      setTrips((current) => { const next = [trip, ...current]; tripsRef.current = next; return next; });
      return trip;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The trip could not be saved.');
      throw cause;
    }
  }, [repository]);

  const duplicateTripAction = useCallback(async (id: string) => {
    try {
      setError(null);
      const copy = await repository.duplicate(id);
      setTrips((current) => { const next = [copy, ...current]; tripsRef.current = next; return next; });
      return copy;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The trip could not be duplicated.');
      throw cause;
    }
  }, [repository]);

  const deleteTrip = useCallback(async (id: string) => {
    try {
      setError(null);
      await repository.delete(id);
      setTrips((current) => { const next = current.filter((trip) => trip.id !== id); tripsRef.current = next; return next; });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The trip could not be deleted.');
      throw cause;
    }
  }, [repository]);

  const updateTrip = useCallback(async (id: string, input: CreateTripInput, expectedUpdatedAt?: string) => {
    const updated = await repository.update(id, input, expectedUpdatedAt ?? revisionFor(id));
    replaceOne(updated);
    return updated;
  }, [repository, replaceOne, revisionFor]);

  const loadTrip = useCallback((id: string) => {
    const pending = pendingReads.current.get(id);
    if (pending) return pending;
    const request = repository.get(id).then((trip) => {
      setReadWarning(repository.getReadWarning?.() ?? null);
      setTrips((current) => {
        const next = trip ? [...current.filter((item) => item.id !== id), trip].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) : current.filter((item) => item.id !== id);
        tripsRef.current = next;
        return next;
      });
      return trip;
    }).finally(() => pendingReads.current.delete(id));
    pendingReads.current.set(id, request);
    return request;
  }, [repository]);

  const saveItinerary = useCallback(async (id: string, itinerary: GeneratedItinerary) => {
    const updated = await repository.saveItinerary(id, itinerary, revisionFor(id));
    replaceOne(updated); setReadWarning(repository.getReadWarning?.() ?? null); return updated;
  }, [repository, replaceOne, revisionFor]);
  const getItineraryWarning = useCallback((id: string) => repository.getItineraryWarning?.(id) ?? null, [repository]);
  const saveDestination = useCallback(async (id: string, resolution: DestinationResolution) => {
    const updated = await repository.saveDestination(id, resolution, revisionFor(id)); replaceOne(updated); return updated;
  }, [repository, replaceOne, revisionFor]);
  const saveStay = useCallback(async (id: string, stay: SelectedStay | null) => {
    const updated = await repository.saveStay(id, stay, revisionFor(id)); replaceOne(updated); setReadWarning(repository.getReadWarning?.() ?? null); return updated;
  }, [repository, replaceOne, revisionFor]);
  const getStayWarning = useCallback((id: string) => repository.getStayWarning?.(id) ?? null, [repository]);
  const saveTransportSettings = useCallback(async (id: string, settings: import('../../features/transport/domain/routing').TransportSettings) => {
    const updated = await repository.saveTransportSettings(id, settings, revisionFor(id)); replaceOne(updated); return updated;
  }, [repository, replaceOne, revisionFor]);
  const saveBudgetLedger = useCallback(async (id: string, ledger: BudgetLedger) => {
    const updated = await repository.saveBudgetLedger(id, ledger, revisionFor(id)); replaceOne(updated); setReadWarning(repository.getReadWarning?.() ?? null); return updated;
  }, [repository, replaceOne, revisionFor]);
  const getBudgetWarning = useCallback((id: string) => repository.getBudgetWarning?.(id) ?? null, [repository]);
  const saveLongDistanceTravel = useCallback(async (id: string, plan: LongDistanceTravelPlan) => {
    const updated = await repository.saveLongDistanceTravel(id, plan, revisionFor(id)); replaceOne(updated); setReadWarning(repository.getReadWarning?.() ?? null); return updated;
  }, [repository, replaceOne, revisionFor]);
  const getLongDistanceTravelWarning = useCallback((id: string) => repository.getLongDistanceTravelWarning?.(id) ?? null, [repository]);
  const exportTrips = useCallback(() => createTripBackup(tripsRef.current), []);
  const value = useMemo(() => ({ trips, isLoading, error, readWarning, syncNotice, loadTrip, createTrip, updateTrip, duplicateTrip: duplicateTripAction, deleteTrip, exportTrips, refresh, saveItinerary, getItineraryWarning, saveDestination, saveStay, getStayWarning, saveTransportSettings, saveBudgetLedger, getBudgetWarning, saveLongDistanceTravel, getLongDistanceTravelWarning }), [trips, isLoading, error, readWarning, syncNotice, loadTrip, createTrip, updateTrip, duplicateTripAction, deleteTrip, exportTrips, refresh, saveItinerary, getItineraryWarning, saveDestination, saveStay, getStayWarning, saveTransportSettings, saveBudgetLedger, getBudgetWarning, saveLongDistanceTravel, getLongDistanceTravelWarning]);
  return <TripsContext.Provider value={{ ...value, assistant }}>{children}</TripsContext.Provider>;
}

export function useTrips() {
  const context = useContext(TripsContext);
  if (!context) throw new Error('useTrips must be used inside TripsProvider.');
  return context;
}
