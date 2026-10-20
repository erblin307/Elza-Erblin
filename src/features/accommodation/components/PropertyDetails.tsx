import { useEffect, useId, useRef } from 'react';
import type { Accommodation } from '../domain/accommodation';
import { propertyTypeLabel } from '../domain/categories';
import { TravelImage } from '../../media/components/TravelImage';
import { Button } from '../../../components/ui/Button';
import styles from './Accommodation.module.css';

export function PropertyFacts({ property }: { property: Accommodation }) {
  return <><TravelImage image={property.place.image} name={property.name} />
    {property.description && <p>{property.description}</p>}
    <dl className={styles.facts}>
      <div><dt>Property type</dt><dd>{property.types.map(propertyTypeLabel).join(' · ')}</dd></div>
      {property.place.address && <div><dt>Address</dt><dd>{property.place.address}</dd></div>}
      <div><dt>Location</dt><dd>{property.location.latitude.toFixed(6)}, {property.location.longitude.toFixed(6)}</dd></div>
      <div><dt>Price</dt><dd>Price unavailable</dd></div><div><dt>Availability</dt><dd>Not checked for your dates. Room capacity and occupancy suitability are unknown.</dd></div>
      {property.place.website && <div><dt>Website</dt><dd><a href={property.place.website} target="_blank" rel="noopener noreferrer">Property website</a></dd></div>}
      <div><dt>Source</dt><dd>{property.place.attribution}<small>Property ID: {property.providerId}</small></dd></div>
    </dl><SourceAttribution /></>;
}
export function SourceAttribution() { return <p className={styles.source}><a href="https://www.geoapify.com/" target="_blank" rel="noopener noreferrer">Powered by Geoapify</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors, ODbL</a></p>; }
export function PropertyDetails({ property, selected, busy, zeroNights, error, onClose, onSelect, onRefresh }: { property: Accommodation | null; selected: boolean; busy: boolean; zeroNights: boolean; error: string | null; onClose: () => void; onSelect: () => void; onRefresh?: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null); const heading = useRef<HTMLHeadingElement>(null); const title = useId();
  useEffect(() => { if (property && !dialog.current?.open) { dialog.current?.showModal(); heading.current?.focus(); } else if (!property && dialog.current?.open) dialog.current.close(); }, [property]);
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby={title} onCancel={(event) => { event.preventDefault(); onClose(); }}><h2 ref={heading} tabIndex={-1} id={title}>{property?.name}</h2>
    {property && <><PropertyFacts property={property} />{busy && <p role="status">Loading property details…</p>}{error && <p role="alert">{error}</p>}
      <p>Selecting a property records your planned stay. Prices, availability and room arrangements must be checked with the property.</p>
      {zeroNights && <p>Your trip has zero nights. Edit your trip dates before selecting an overnight stay.</p>}
      <div className={styles.actions}><Button disabled={busy || selected || zeroNights} onClick={onSelect}>{selected ? 'Selected for this trip' : 'Select accommodation'}</Button>{onRefresh && <Button variant="secondary" disabled={busy} onClick={onRefresh}>Refresh property details</Button>}<Button variant="secondary" onClick={onClose}>Close property details</Button></div></>}
  </dialog>;
}
