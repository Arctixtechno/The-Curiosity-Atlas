import { useThree } from '@react-three/fiber'
import { useLayoutEffect } from 'react'
import { useGame } from './store.ts'

/** Places the first-person camera wherever the player last arrived. */
export function Camera() {
  const camera = useThree((state) => state.camera)
  const arrival = useGame((s) => s.arrival)

  useLayoutEffect(() => {
    camera.position.set(...arrival.position)
    camera.rotation.set(0, arrival.yaw, 0, 'YXZ')
  }, [camera, arrival])

  return null
}
