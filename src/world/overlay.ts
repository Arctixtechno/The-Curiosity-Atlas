import { gameStore } from './store.ts'

// Panels that pause exploring: opening one releases the mouse, closing it
// takes the mouse back so the player carries on where they were.

export function openOverlay(id: string) {
  gameStore.set({ overlay: id, prompt: null })
  if (document.pointerLockElement) document.exitPointerLock()
}

/** Closes the panel. Called from a click or key press, so the browser allows taking the mouse back. */
export function closeOverlay() {
  if (!gameStore.get().overlay) return
  gameStore.set({ overlay: null })
  const canvas = document.querySelector('canvas')
  // Some browsers refuse straight after an unlock; the player can still click to carry on.
  canvas?.requestPointerLock()?.catch?.(() => undefined)
}

export function toggleOverlay(id: string) {
  if (gameStore.get().overlay === id) closeOverlay()
  else openOverlay(id)
}
