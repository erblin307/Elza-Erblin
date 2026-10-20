import type { TripPreferences } from '../../trips/types/trip';

export const discoveryCategories = {
  all: ['tourism.sights', 'entertainment.museum', 'catering.restaurant', 'catering.cafe', 'leisure.park'],
  history: ['tourism.sights'], museums: ['entertainment.museum'], food: ['catering.restaurant', 'catering.cafe'], nature: ['leisure.park'],
} as const;
export type PlaceFilter = keyof typeof discoveryCategories;
export function translateCategories(categories: string[]): TripPreferences['interests'] {
  const interests = new Set<TripPreferences['interests'][number]>();
  for (const category of categories) {
    if (category === 'tourism.sights' || category.startsWith('tourism.sights.')) { interests.add('history'); interests.add('architecture'); }
    if (category === 'entertainment.museum' || category.startsWith('entertainment.museum.')) { interests.add('museums'); interests.add('culture'); }
    if (category.startsWith('catering.restaurant') || category.startsWith('catering.cafe')) interests.add('food');
    if (category === 'leisure.park' || category.startsWith('leisure.park.')) { interests.add('nature'); interests.add('relaxation'); }
  }
  return [...interests].sort();
}
export function categoriesForInterests(interests: TripPreferences['interests']): string[] {
  const values = new Set<string>();
  for (const interest of interests) {
    if (['history', 'architecture'].includes(interest)) discoveryCategories.history.forEach((value) => values.add(value));
    if (['museums', 'culture'].includes(interest)) discoveryCategories.museums.forEach((value) => values.add(value));
    if (interest === 'food') discoveryCategories.food.forEach((value) => values.add(value));
    if (['nature', 'relaxation'].includes(interest)) discoveryCategories.nature.forEach((value) => values.add(value));
  }
  return values.size ? [...values].sort() : [...discoveryCategories.all];
}
