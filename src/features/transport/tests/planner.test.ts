import { describe, expect, it } from 'vitest';
import { planSegments, settingsFor, detectTravelConflict, dailyTotals } from '../domain/planner';
import { normalizeRoute } from '../domain/routing';
import { transportTrip, routeResponse } from './testData';
import { editItinerary } from '../../itinerary/domain/editing';
import { property } from '../../accommodation/tests/testData';
describe('Derived travel connections', () => {
  it('retains exact ordered adjacency and does not modify itinerary', () => {
    const before=JSON.stringify(transportTrip); const segments=planSegments(transportTrip);
    for(const day of transportTrip.itinerary.days) expect(segments.filter((s)=>s.dayId===day.id).map((s)=>[s.from.id,s.to.id])).toEqual(day.items.slice(1).map((item,index)=>[day.items[index]!.id,item.id]));
    expect(JSON.stringify(transportTrip)).toBe(before);
  });
  it('uses optional hotel origin/return and handles absent/stale stays', () => {
    const settings={...settingsFor(transportTrip),hotelOrigin:true,hotelReturn:true}; const segments=planSegments(transportTrip,settings);
    expect(segments.filter((s)=>s.from.id.startsWith('stay-'))).toHaveLength(3);expect(segments.filter((s)=>s.to.id.startsWith('stay-'))).toHaveLength(3);
    expect(planSegments({...transportTrip,selectedStay:undefined},settings)).toHaveLength(3);
    expect(planSegments({...transportTrip,selectedStay:{...transportTrip.selectedStay,travelers:99}},settings).filter((s)=>s.from.id.startsWith('stay-')).every((s)=>!s.request)).toBe(true);
  });
  it('hotel replacement affects anchors but preserves activity routes', () => {
    const settings={...settingsFor(transportTrip),hotelOrigin:true};const before=planSegments(transportTrip,settings);
    const after=planSegments({...transportTrip,selectedStay:{...transportTrip.selectedStay,property:property('replacement')}},settings);
    expect(before.filter((s)=>s.from.item).map((s)=>s.key)).toEqual(after.filter((s)=>s.from.item).map((s)=>s.key));expect(before[0]!.id).not.toBe(after[0]!.id);
  });
  it('marks missing endpoint unavailable without bridging over it', () => {
    const trip=structuredClone(transportTrip);trip.itinerary.catalog[0]!.location=undefined;
    expect(planSegments(trip).some((s)=>s.unavailable?.includes('coordinates') && !s.request)).toBe(true);
  });
  it.each(['remove','reorder','move'] as const)('%s invalidates affected adjacency while preserving manual changes', (type) => {
    const day=transportTrip.itinerary.days[0]!; const item=day.items[0]!;
    const itinerary=editItinerary(transportTrip.itinerary,type==='remove'?{type,itemId:item.id}:type==='reorder'?{type,itemId:item.id,direction:'down'}:{type,itemId:item.id,dayId:transportTrip.itinerary.days[1]!.id});
    const after=planSegments({...transportTrip,itinerary});const old=planSegments(transportTrip).find((s)=>s.from.id===item.id)!;
    expect(after.some((s)=>s.id===old.id)).toBe(false); expect(itinerary.metadata.manuallyAdjusted).toBe(true);
  });
  it('handles zero/one activity and mode overrides without changing planner preferences', () => {
    const trip=structuredClone(transportTrip);trip.itinerary.days[0]!.items=[];trip.itinerary.days[1]!.items.splice(1);
    expect(planSegments(trip).filter((s)=>s.dayId!==trip.itinerary.days[2]!.id)).toHaveLength(0);
    const segment=planSegments(transportTrip)[0]!; const settings={...settingsFor(transportTrip),segmentModes:{[segment.id]:'drive' as const}};
    expect(planSegments(transportTrip,settings)[0]!.mode).toBe('drive');expect(transportTrip.preferences!.transportation).toEqual(['walking']);
  });
  it('reports partial totals and unknown timing honestly', () => {
    const segments=planSegments(transportTrip);const route=normalizeRoute(routeResponse(segments[0]!.request),segments[0]!.request!,new Date().toISOString());
    const total=dailyTotals(segments,(s)=>s===segments[0]?route:undefined);expect(total.complete).toBe(false);expect(total.distanceMeters).toBe(1500);
    expect(detectTravelConflict({endMinute:600},{startMinute:620},1201)).toBe('conflict');expect(detectTravelConflict({endMinute:600},{startMinute:620},1200)).toBe('fits');expect(detectTravelConflict(undefined,{startMinute:620},1200)).toBe('unknown');expect(detectTravelConflict({endMinute:600},{startMinute:620})).toBe('unknown');
  });
});
