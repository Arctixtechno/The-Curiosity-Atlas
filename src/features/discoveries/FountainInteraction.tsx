import { Vector3 } from 'three'
import { useInteractable } from '../../world/InteractionSystem.tsx'
import { openPanel } from '../panels.ts'

const FOUNTAIN_POSITION = new Vector3(0, 0, 0)

/** Makes the main hall fountain open the Discovery Fountain (spec section 5.1). */
export function FountainInteraction() {
  useInteractable({
    position: FOUNTAIN_POSITION,
    radius: 2.4,
    prompt: 'Press E to visit the Discovery Fountain',
    onInteract: () => openPanel('fountain'),
  })
  return null
}
