import { useMemo } from 'react'
import { Vector3 } from 'three'
import { useInteractable } from '../../world/InteractionSystem.tsx'
import { openPanel } from '../panels.ts'

/** Makes the courtyard fountain open the Discovery Fountain (spec section 5.1). */
export function FountainInteraction({ x, z, radius }: { x: number; z: number; radius: number }) {
  useInteractable({
    position: useMemo(() => new Vector3(x, 0, z), [x, z]),
    radius,
    prompt: 'Press E to visit the Discovery Fountain',
    onInteract: () => openPanel('fountain'),
  })
  return null
}
