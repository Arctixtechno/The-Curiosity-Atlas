import { useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect } from 'react'
import type { PerspectiveCamera } from 'three'
import { useSettings } from './settings.ts'
import { useGame } from './store.ts'

/** Places the first-person camera wherever the player last arrived, with the player's field of view. */
export function Camera() {
  const camera = useThree((state) => state.camera)
  const arrival = useGame((s) => s.arrival)
  const fov = useSettings((s) => s.fov)
  const viewing = useGame((s) => s.viewing)

  useLayoutEffect(() => {
    camera.position.set(...arrival.position)
    camera.rotation.set(0, arrival.yaw, 0, 'YXZ')
  }, [camera, arrival])

  // The player's chosen field of view. Instruments such as the telescope set their own while in use.
  useEffect(() => {
    if (viewing) return
    const perspective = camera as PerspectiveCamera
    perspective.fov = fov
    perspective.updateProjectionMatrix()
  }, [camera, fov, viewing])

  return null
}
