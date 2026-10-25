import { useEffect, useMemo } from 'react'
import { LatheGeometry, Vector2 } from 'three'

/** A lathe profile from [radius, height] pairs, for turned, carved and blown shapes. */
export function useLathe(points: [number, number][], segments = 24) {
  const geometry = useMemo(
    () =>
      new LatheGeometry(
        points.map(([r, y]) => new Vector2(r, y)),
        segments,
      ),
    [points, segments],
  )
  useEffect(() => () => geometry.dispose(), [geometry])
  return geometry
}
