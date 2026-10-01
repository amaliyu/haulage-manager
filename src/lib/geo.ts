// Same sum as public.distance_m in the database, so the driver sees what the
// office will see. The database result is the one that counts.

const EARTH_RADIUS_M = 6_371_000

export function distanceM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = (d: number) => (d * Math.PI) / 180
  const a =
    Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2
  return Math.round(2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a)))
}

/** GPS accuracy counts towards the site radius, up to 200m, so a weak fix is not punished. */
export function insideSite(distance: number, radiusM: number, accuracyM: number): boolean {
  return distance <= radiusM + Math.min(Math.max(accuracyM, 0), 200)
}
