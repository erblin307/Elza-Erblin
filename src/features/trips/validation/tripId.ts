// IDs are opaque route-safe keys, not destination names.
export function isValidTripId(value: string | undefined): value is string {
  return typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(value);
}
