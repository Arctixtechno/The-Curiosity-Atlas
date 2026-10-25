// Simple, honest walking estimates from coordinates alone. Streets rarely run
// straight, so straight-line distances are stretched by a detour factor;
// times are estimates, not routes.

export type LatLng = [lat: number, lng: number]

const EARTH_RADIUS_M = 6_371_000
/** Typical ratio of street distance to straight-line distance in central London. */
export const DETOUR_FACTOR = 1.3
/** A comfortable city walking pace, in metres per minute (about 4.5 km/h). */
export const WALK_M_PER_MIN = 75

/** Great-circle distance in metres. */
export function distanceMetres([lat1, lng1]: LatLng, [lat2, lng2]: LatLng) {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a))
}

/** Estimated minutes on foot between two points, allowing for streets not running straight. */
export function walkMinutes(from: LatLng, to: LatLng) {
  return (distanceMetres(from, to) * DETOUR_FACTOR) / WALK_M_PER_MIN
}

/**
 * Orders stops into a short walk: start at `start`, then repeatedly go to
 * the nearest stop not yet visited. Not always the very shortest route, but
 * close for a handful of stops, and easy to follow.
 */
export function walkingOrder<T extends { at: LatLng }>(stops: T[], start: LatLng): T[] {
  const left = [...stops]
  const order: T[] = []
  let here = start
  while (left.length) {
    let best = 0
    for (let i = 1; i < left.length; i++) {
      if (distanceMetres(here, left[i].at) < distanceMetres(here, left[best].at)) best = i
    }
    const [next] = left.splice(best, 1)
    order.push(next)
    here = next.at
  }
  return order
}

export interface ItineraryStop<T> {
  stop: T
  /** Minutes walking from the previous stop (0 for the first). */
  walk: number
  /** Minutes from the start when you arrive. */
  arrive: number
}

/**
 * Builds a walk through as many stops as fit in `minutes`, nearest first,
 * spending each stop's suggested visit time there.
 */
export function planWalk<T extends { at: LatLng; visitMinutes: number }>(stops: T[], start: LatLng, minutes: number) {
  const plan: ItineraryStop<T>[] = []
  let clock = 0
  let here = start
  for (const stop of walkingOrder(stops, start)) {
    const walk = plan.length ? walkMinutes(here, stop.at) : 0
    if (clock + walk + stop.visitMinutes > minutes) continue
    plan.push({ stop, walk: Math.round(walk), arrive: Math.round(clock + walk) })
    clock += walk + stop.visitMinutes
    here = stop.at
  }
  return { stops: plan, totalMinutes: Math.round(clock) }
}
