import { useSyncExternalStore } from 'react'

// Which full-screen feature panel (if any) is open over the 3D world. Opening
// one releases the mouse so the visitor can click and type; closing one with
// a click captures it again so exploring carries on.

export type PanelId = 'fountain' | 'library'

let open: PanelId | null = null
const listeners = new Set<() => void>()

function set(next: PanelId | null) {
  open = next
  listeners.forEach((l) => l())
}

export function openPanel(id: PanelId) {
  if (document.pointerLockElement) document.exitPointerLock()
  set(id)
}

/** Closes the panel. With `resume`, the player goes straight back to exploring (needs a click or key press to allow it). */
export function closePanel(resume = false) {
  set(null)
  // The world's pointer-lock controls capture the mouse on any document click.
  if (resume) document.dispatchEvent(new MouseEvent('click'))
}

export function useOpenPanel(): PanelId | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => {
        listeners.delete(l)
      }
    },
    () => open,
  )
}
