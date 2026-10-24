import { Vector3 } from 'three'
import { useInteractable } from '../../world/InteractionSystem.tsx'
import { openPanel } from '../panels.ts'

/** Sitting in the lounge armchair opens the conversation. */
export function LoungeInteraction({ position }: { position: [number, number, number] }) {
  useInteractable({
    position: new Vector3(...position),
    radius: 2.6,
    prompt: 'Press E to sit and talk',
    onInteract: () => openPanel('lounge'),
  })
  return null
}
