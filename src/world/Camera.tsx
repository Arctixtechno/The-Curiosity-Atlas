import { useThree } from '@react-three/fiber'
import { useLayoutEffect } from 'react'

interface CameraProps {
  position: [number, number, number]
  yaw: number
}

/** Places the first-person camera at a room's spawn point. */
export function Camera({ position, yaw }: CameraProps) {
  const camera = useThree((state) => state.camera)

  useLayoutEffect(() => {
    camera.position.set(...position)
    camera.rotation.set(0, yaw, 0, 'YXZ')
  }, [camera, position, yaw])

  return null
}
