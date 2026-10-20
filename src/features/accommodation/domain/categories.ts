export const accommodationCategories = { all: 'accommodation', hotel: 'accommodation.hotel', apartment: 'accommodation.apartment', hostel: 'accommodation.hostel', guesthouse: 'accommodation.guest_house', motel: 'accommodation.motel' } as const;
export type AccommodationFilter = keyof typeof accommodationCategories;
export const propertyTypes = ['hotel', 'apartment', 'hostel', 'guesthouse', 'motel', 'other'] as const;
export type PropertyType = typeof propertyTypes[number];
export const accommodationLabels = { all: 'All accommodation', hotel: 'Hotels', apartment: 'Apartments', hostel: 'Hostels', guesthouse: 'Guesthouses', motel: 'Motels' } as const;
export function propertyTypesFor(categories: string[]): PropertyType[] {
  const matches = propertyTypes.filter((type) => type !== 'other' && categories.some((category) => category === accommodationCategories[type] || category.startsWith(`${accommodationCategories[type]}.`)));
  return matches.length ? matches : categories.some((category) => category === 'accommodation' || category.startsWith('accommodation.')) ? ['other'] : [];
}
export function propertyTypeLabel(type: PropertyType) { return type === 'guesthouse' ? 'Guesthouse' : type === 'other' ? 'Other accommodation' : type[0]!.toUpperCase() + type.slice(1); }
