import { Vector3 } from 'three'
import { useInteractable } from '../../world/InteractionSystem.tsx'
import { sitDown } from './Seat.tsx'

/** The visitor's armchair: E sits down in it, and the conversation opens once seated. */
export function LoungeInteraction({ position }: { position: [number, number, number] }) {
  useInteractable({
    position: new Vector3(...position),
    radius: 2.6,
    prompt: 'Press E to sit down and talk',
    onInteract: () => setTimeout(sitDown),
  })
  return null
}
