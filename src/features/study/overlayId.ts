// Kept apart from the panel, so the study room can open it without loading it.

export type StudyTab = 'timer' | 'todo' | 'notes' | 'cards'

const PREFIX = 'study:'

export const studyOverlay = (tab: StudyTab) => PREFIX + tab

/** The tab an overlay id opens, if it is one of the study room's. */
export function studyTabFromOverlay(overlay: string | null): StudyTab | null {
  if (!overlay?.startsWith(PREFIX)) return null
  const tab = overlay.slice(PREFIX.length)
  return tab === 'timer' || tab === 'todo' || tab === 'notes' || tab === 'cards' ? tab : null
}
