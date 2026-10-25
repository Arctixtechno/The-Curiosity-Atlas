import { PerformanceMonitor } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { useState } from 'react'
import { Hud } from './components/Hud.tsx'
import { Overlays } from './components/Overlays.tsx'
import { World } from './world/World.tsx'

/**
 * Render resolution bounds, as a multiple of CSS pixels. Retina screens report
 * 2 or more, which means four times the pixels of 1; 1.5 looks nearly as sharp
 * at a fraction of the cost.
 */
const MIN_DPR = 1
const MAX_DPR = Math.min(1.5, typeof window === 'undefined' ? 1 : window.devicePixelRatio)

export default function App() {
  const [dpr, setDpr] = useState(MAX_DPR)
  return (
    <>
      <Canvas
        shadows="percentage"
        dpr={dpr}
        gl={{ powerPreference: 'high-performance' }}
        camera={{ fov: 70, near: 0.05, far: 100 }}
      >
        {/* Drops the resolution when the frame rate can't keep up, and raises it again when it can. */}
        <PerformanceMonitor
          flipflops={4}
          onChange={({ factor }) => setDpr(Math.round((MIN_DPR + (MAX_DPR - MIN_DPR) * factor) * 10) / 10)}
        />
        <World />
      </Canvas>
      <Hud />
      <Overlays />
    </>
  )
}
