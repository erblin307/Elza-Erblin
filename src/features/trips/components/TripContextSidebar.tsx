import { BedDouble, ChevronDown, LayoutList, ListOrdered, Map, Search, Route, WalletCards, Plane, MessageSquare } from 'lucide-react';
import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import type { Trip } from '../types/trip';
import { formatDateRange } from '../utils/tripFormatters';
import styles from './TripWorkspace.module.css';

export function TripContextSidebar({ trip }: { trip: Trip }) {
  const [expanded, setExpanded] = useState(false);
  const { pathname } = useLocation();
  const overviewPath = `/trips/${encodeURIComponent(trip.id)}`;
  const editing = pathname.endsWith('/edit');
  const itinerary = pathname.endsWith('/itinerary');
  const map = pathname.endsWith('/map');
  const places = pathname.endsWith('/places');
  const accommodation = pathname.endsWith('/accommodation');
  const transport = pathname.endsWith('/transport');
  const travel = pathname.endsWith('/travel');
  const budget = pathname.endsWith('/budget');
  return <aside className={styles.sidebar} aria-label="Trip context">
    <button type="button" className={styles.menuToggle} aria-expanded={expanded} aria-controls="trip-context-navigation" onClick={() => setExpanded((current) => !current)}>
      <span>Trip navigation <strong>{pathname.endsWith('/assistant') ? 'Assistant' : editing ? 'Edit trip' : budget ? 'Budget' : travel ? 'Travel' : transport ? 'Transport' : accommodation ? 'Stay' : places ? 'Places' : map ? 'Map' : itinerary ? 'Itinerary' : 'Overview'}</strong></span><ChevronDown size={16} className={expanded ? styles.rotated : ''} aria-hidden="true" />
    </button>
    <div id="trip-context-navigation" className={`${styles.sidebarBody} ${expanded ? '' : styles.collapsed}`}>
      <div className={styles.tripIdentity}><span className={styles.eyebrow}>Your trip</span><p className={styles.destination} title={trip.destination}>{trip.destination}</p><p className={styles.sidebarDates}>{formatDateRange(trip.startDate, trip.endDate)}</p><p className={styles.sidebarOrigin}>From {trip.origin}</p></div>
      <nav aria-label="Trip navigation" className={styles.contextNav}>
        <NavLink to={overviewPath} end onClick={() => setExpanded(false)} className={({ isActive }) => `${styles.contextLink} ${isActive ? styles.contextActive : ''}`}><LayoutList size={17} aria-hidden="true" />Overview</NavLink>
        <NavLink to={`${overviewPath}/itinerary`} onClick={() => setExpanded(false)} className={({ isActive }) => `${styles.contextLink} ${isActive ? styles.contextActive : ''}`}><ListOrdered size={17} aria-hidden="true" />Itinerary</NavLink>
        <NavLink to={`${overviewPath}/map`} onClick={() => setExpanded(false)} className={({ isActive }) => `${styles.contextLink} ${isActive ? styles.contextActive : ''}`}><Map size={17} aria-hidden="true" />Map</NavLink>
        <NavLink to={`${overviewPath}/places`} onClick={() => setExpanded(false)} className={({ isActive }) => `${styles.contextLink} ${isActive ? styles.contextActive : ''}`}><Search size={17} aria-hidden="true" />Places</NavLink>
        <NavLink to={`${overviewPath}/accommodation`} onClick={() => setExpanded(false)} className={({ isActive }) => `${styles.contextLink} ${isActive ? styles.contextActive : ''}`}><BedDouble size={17} aria-hidden="true" />Stay</NavLink>
        <NavLink to={`${overviewPath}/transport`} onClick={() => setExpanded(false)} className={({ isActive }) => `${styles.contextLink} ${isActive ? styles.contextActive : ''}`}><Route size={17} aria-hidden="true" />Transport</NavLink>
        <NavLink to={`${overviewPath}/travel`} onClick={() => setExpanded(false)} className={({ isActive }) => `${styles.contextLink} ${isActive ? styles.contextActive : ''}`}><Plane size={17} aria-hidden="true" />Travel / Flights</NavLink>
        <NavLink to={`${overviewPath}/budget`} onClick={() => setExpanded(false)} className={({ isActive }) => `${styles.contextLink} ${isActive ? styles.contextActive : ''}`}><WalletCards size={17} aria-hidden="true" />Budget</NavLink>
        <NavLink to={`${overviewPath}/assistant`} onClick={() => setExpanded(false)} className={({ isActive }) => `${styles.contextLink} ${isActive ? styles.contextActive : ''}`}><MessageSquare size={17} aria-hidden="true" />Assistant</NavLink>
      </nav>
    </div>
  </aside>;
}
