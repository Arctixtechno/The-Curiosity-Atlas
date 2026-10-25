import type { Discovery } from './types.ts'

const DAY_MS = 24 * 60 * 60 * 1000

/** Whole days since 1 Jan 1970 in the visitor's own time zone, so the discovery changes at local midnight. */
export function localDayNumber(date: Date): number {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS)
}

/** Today's discovery: the same for everyone on a given day, cycling through the whole list. */
export function dailyDiscovery(list: Discovery[], date = new Date()): Discovery {
  return list[localDayNumber(date) % list.length]
}

/** "Something completely unexpected": any discovery except the one being shown, preferring a different subject. */
export function unexpectedDiscovery(list: Discovery[], current: Discovery, random = Math.random): Discovery {
  const otherTopics = list.filter((d) => d.topic !== current.topic)
  const pool = otherTopics.length > 0 ? otherTopics : list.filter((d) => d.id !== current.id)
  if (pool.length === 0) return current
  return pool[Math.floor(random() * pool.length) % pool.length]
}
