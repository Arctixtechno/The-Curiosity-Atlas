// Kept apart from the exhibits, so the museum and the overlay host can open a panel without loading its text.
export const EXHIBIT_IDS = ['rosetta', 'meteorite', 'astrolabe', 'chronometer', 'ammonite', 'antikythera'] as const
export type ExhibitId = (typeof EXHIBIT_IDS)[number]

/** Each exhibit's panel has its own overlay id. */
export const exhibitOverlay = (id: ExhibitId) => `museum:${id}`

export function exhibitFromOverlay(overlay: string | null): ExhibitId | null {
  const id = overlay?.startsWith('museum:') ? overlay.slice(7) : null
  return (EXHIBIT_IDS as readonly string[]).includes(id ?? '') ? (id as ExhibitId) : null
}
