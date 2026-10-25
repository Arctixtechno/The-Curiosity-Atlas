import { useFrame } from '@react-three/fiber'
import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react'
import { Vector3 } from 'three'
import { gameStore } from './store.ts'

export interface Interactable {
  /** World position the player has to be near and looking towards. */
  position: Vector3
  /** How close (in metres, on the floor plane) the player must be. */
  radius: number
  prompt: string
  /** Called when the player presses E. Omit for objects that only show a prompt. */
  onInteract?: () => void
}

type Registry = Set<Interactable>

const InteractionContext = createContext<Registry | null>(null)

/** Minimum cosine between the view direction and the object (about 50°). */
const FACING_THRESHOLD = 0.65

const view = new Vector3()
const toItem = new Vector3()

/**
 * Finds the interactable object the player is near and facing, shows its
 * prompt, and triggers it when E is pressed (spec section 3.5).
 */
export function InteractionSystem({ children }: { children: ReactNode }) {
  const registry = useRef<Registry>(new Set()).current
  const focused = useRef<Interactable | null>(null)

  useFrame(({ camera }) => {
    const { isExploring, transitioning, prompt, viewing } = gameStore.get()
    let best: Interactable | null = null

    if (isExploring && !transitioning && !viewing) {
      camera.getWorldDirection(view)
      view.y = 0
      view.normalize()
      let bestDistance = Infinity
      for (const item of registry) {
        toItem.set(item.position.x - camera.position.x, 0, item.position.z - camera.position.z)
        const distance = toItem.length()
        if (distance > item.radius || distance >= bestDistance) continue
        if (distance > 0.001 && toItem.divideScalar(distance).dot(view) < FACING_THRESHOLD) continue
        best = item
        bestDistance = distance
      }
    }

    focused.current = best
    const nextPrompt = best?.prompt ?? null
    if (nextPrompt !== prompt) gameStore.set({ prompt: nextPrompt })
  })

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyE' && !e.repeat && gameStore.get().isExploring) focused.current?.onInteract?.()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return <InteractionContext.Provider value={registry}>{children}</InteractionContext.Provider>
}

/** Registers an object with the interaction system while it is mounted. */
export function useInteractable(item: Interactable) {
  const registry = useContext(InteractionContext)
  // Keep the registered object stable and copy the latest props into it, so
  // prompt and callback changes apply without re-registering.
  const stable = useRef(item).current
  Object.assign(stable, item)

  useEffect(() => {
    if (!registry) return
    registry.add(stable)
    return () => {
      registry.delete(stable)
    }
  }, [registry, stable])
}
