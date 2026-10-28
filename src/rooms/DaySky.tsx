import { useEffect, useMemo } from 'react'
import { BackSide, Color, ShaderMaterial, Vector3 } from 'three'
import type { DayPhase } from '../world/clock.ts'

// The sky by day, at dusk and at dawn, for rooms that look out through an
// opening rather than standing outdoors: a gradient from the horizon up, a
// soft sun and a glow round it. One cheap shader on a big sphere.

const COLOURS: Record<Exclude<DayPhase, 'night'>, { zenith: string; horizon: string; glow: string }> = {
  day: { zenith: '#4a7fc4', horizon: '#c8dcef', glow: '#fff6e0' },
  dusk: { zenith: '#2a2c5a', horizon: '#f0905a', glow: '#ffb070' },
  dawn: { zenith: '#4a5a90', horizon: '#f4b8a0', glow: '#ffd8b0' },
}

export function DaySky({
  phase,
  sun,
  radius = 84,
}: {
  phase: Exclude<DayPhase, 'night'>
  sun: [number, number, number]
  radius?: number
}) {
  const material = useMemo(() => {
    const c = COLOURS[phase]
    return new ShaderMaterial({
      uniforms: {
        zenith: { value: new Color(c.zenith) },
        horizon: { value: new Color(c.horizon) },
        glow: { value: new Color(c.glow) },
        sun: { value: new Vector3(...sun).normalize() },
      },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 zenith;
        uniform vec3 horizon;
        uniform vec3 glow;
        uniform vec3 sun;
        varying vec3 vDir;
        void main() {
          vec3 d = normalize(vDir);
          float up = clamp(d.y, 0.0, 1.0);
          vec3 colour = mix(horizon, zenith, pow(up, 0.55));
          float toSun = max(dot(d, sun), 0.0);
          colour += glow * (pow(toSun, 8.0) * 0.35 + pow(toSun, 600.0) * 3.0);
          gl_FragColor = vec4(colour, 1.0);
        }
      `,
      side: BackSide,
      depthWrite: false,
    })
  }, [phase, sun])
  useEffect(() => () => material.dispose(), [material])
  return (
    <mesh material={material} renderOrder={1}>
      <sphereGeometry args={[radius, 32, 16]} />
    </mesh>
  )
}
