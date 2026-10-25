import { useEffect, useMemo } from 'react'
import { surfaceTexture, tiled, type TextureName } from '../components/textures.ts'

/** A shared procedural tile repeated `x` × `y` times, released when the component unmounts. */
export function useTiledTexture(name: TextureName | undefined, x: number, y: number) {
  const texture = useMemo(() => (name ? tiled(name, x, y) : null), [name, x, y])
  useEffect(() => () => texture?.dispose(), [texture])
  return texture
}

/**
 * A procedural texture painted for one `width` × `height` metre surface, so
 * it never visibly repeats. Released when the component unmounts.
 */
export function useSurfaceTexture(
  name: TextureName | undefined,
  width: number,
  height: number,
  seed = 1,
  pixelsPerMetre?: number,
) {
  const texture = useMemo(
    () => (name ? surfaceTexture(name, width, height, seed, pixelsPerMetre) : null),
    [name, width, height, seed, pixelsPerMetre],
  )
  useEffect(() => () => texture?.dispose(), [texture])
  return texture
}
