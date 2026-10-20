import { useEffect, useRef } from 'react';
import { formatDate, preferenceLabel } from '../../trips/utils/tripFormatters';
import { formatTime } from '../../itinerary/domain/scheduling';
import type { MapActivity } from '../domain/mapData';
import styles from './MapWorkspace.module.css';

export function MapActivityList({ activities, selectedId, onSelect }: { activities: MapActivity[]; selectedId: string | null; onSelect: (id: string) => void }) {
  const list = useRef<HTMLOListElement>(null);
  useEffect(() => {
    if (!selectedId) return;
    const row = Array.from(list.current?.querySelectorAll<HTMLElement>('[data-item-id]') ?? []).find((row) => row.dataset.itemId === selectedId);
    // Scroll this panel only, without moving the whole page or stealing keyboard focus.
    if (row && list.current) list.current.scrollTo?.({ top: list.current.scrollTop + row.getBoundingClientRect().top - list.current.getBoundingClientRect().top - 8, behavior: 'auto' });
  }, [selectedId]);
  return <ol ref={list} className={styles.activityList} aria-label="Map itinerary activities">
    {activities.map((entry) => <li key={entry.id} data-item-id={entry.id}>
      <button type="button" className={styles.activityRow} aria-pressed={selectedId === entry.id} onClick={() => onSelect(entry.id)} aria-label={`Select ${entry.candidate?.name ?? 'Unavailable activity'} · Day ${entry.dayNumber} activity ${entry.item.order + 1}`}>
        <span className={styles.ordinal}>{entry.dayNumber}.{entry.item.order + 1}</span><span><strong>{entry.candidate?.name ?? 'Activity details unavailable'}</strong><span>Day {entry.dayNumber} · {formatDate(entry.date, { month: 'short', day: 'numeric' })} · Suggested {formatTime(entry.item.startMinute)}</span><span>{entry.candidate?.categories.map(preferenceLabel).join(' · ')}</span><span>{entry.location ? 'Location supplied' : 'Location unavailable'}</span></span>
      </button>
    </li>)}
    {!activities.length && <li className={styles.emptyList}>No activities planned for this filter.</li>}
  </ol>;
}
