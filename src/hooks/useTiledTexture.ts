import { useEffect, useMemo } from 'react'
import { tiled, type TextureName } from '../components/textures.ts'

/** A procedural texture repeated `x` × `y` times, released when the component unmounts. */
export function useTiledTexture(name: TextureName | undefined, x: number, y: number) {
  const texture = useMemo(() => (name ? tiled(name, x, y) : null), [name, x, y])
  useEffect(() => () => texture?.dispose(), [texture])
  return texture
}
