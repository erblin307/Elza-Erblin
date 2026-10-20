import { Button } from '../../../components/ui/Button';
import { TravelImage } from '../../media/components/TravelImage';
import { preferenceLabel } from '../../trips/utils/tripFormatters';
import type { Trip } from '../../trips/types/trip';
import { rankPlaces } from '../services/placesService';
import { placeAlreadyPlanned } from '../services/itineraryPlaces';
import type { Place } from '../domain/normalization';
import styles from './Places.module.css';

export function PlaceList({ places, trip, busy, onDetails, onAdd }: { places: Place[]; trip: Trip; busy: boolean; onDetails: (id: string) => void; onAdd: (id: string) => void }) {
  return <ul className={styles.list} aria-label="Discovered places">{rankPlaces(places, trip).map(({ place, reasons }) => <li className={styles.row} key={place.id}>
    <TravelImage image={place.place.image} name={place.name} /><div><h3>{place.name}</h3><p>{place.categories.map(preferenceLabel).join(' · ')}</p>{place.place.address && <p>{place.place.address}</p>}<p>{place.place.provider === 'fixture' ? 'Development fixture · static sourced landmark' : 'Geoapify / OpenStreetMap'}</p><p className={styles.reason}>{reasons[0]}</p><div className={styles.rowActions}><Button variant="secondary" disabled={busy} aria-label={`Details for ${place.name}`} onClick={() => onDetails(place.id)}>Details</Button><Button variant="ghost" disabled={busy || placeAlreadyPlanned(trip, place)} aria-label={`Add ${place.name} to itinerary`} onClick={() => onAdd(place.id)}>{placeAlreadyPlanned(trip, place) ? 'Already planned' : 'Add to itinerary'}</Button></div></div>
  </li>)}</ul>;
}
