import { useThree } from '@react-three/fiber'
import { useLayoutEffect } from 'react'
import { Color, Fog } from 'three'

interface AtmosphereProps {
  background: string
  /** Distance where fog starts and where it fully hides the scene. Omit for no fog. */
  fog?: [near: number, far: number]
}

/**
 * Sets the scene background and fog for a room. Done imperatively because
 * declarative `attach` restores the previous room's values on unmount, which
 * races with the next room mounting.
 */
export function Atmosphere({ background, fog }: AtmosphereProps) {
  const scene = useThree((state) => state.scene)
  const [near, far] = fog ?? []

  useLayoutEffect(() => {
    scene.background = new Color(background)
    scene.fog = near !== undefined && far !== undefined ? new Fog(background, near, far) : null
  }, [scene, background, near, far])

  return null
}
