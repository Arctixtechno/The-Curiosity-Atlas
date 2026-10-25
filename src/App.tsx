import { PerformanceMonitor } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { useState } from 'react'
import { GraphicsErrorBoundary, GraphicsProblem } from './components/GraphicsProblem.tsx'
import { Hud } from './components/Hud.tsx'
import { Overlays } from './components/Overlays.tsx'
import { useSettings } from './world/settings.ts'
import { World } from './world/World.tsx'

/**
 * Render resolution bounds, as a multiple of CSS pixels. Retina screens report
 * 2 or more, which means four times the pixels of 1; 1.5 looks nearly as sharp
 * at a fraction of the cost.
 */
const MIN_DPR = 1
const MAX_DPR = Math.min(1.5, typeof window === 'undefined' ? 1 : window.devicePixelRatio)
/** The "Low" quality setting: fewer pixels than the screen has, for slower machines. */
const LOW_DPR = 0.75

export default function App() {
  const [autoDpr, setAutoDpr] = useState(MAX_DPR)
  const quality = useSettings((s) => s.quality)
  const dpr = quality === 'auto' ? autoDpr : quality === 'high' ? MAX_DPR : LOW_DPR
  // The browser can take the graphics context away (a driver reset, or too many tabs using WebGL).
  const [contextLost, setContextLost] = useState(false)
  return (
    <GraphicsErrorBoundary>
      <Canvas
        shadows="percentage"
        dpr={dpr}
        gl={{ powerPreference: 'high-performance' }}
        camera={{ fov: 70, near: 0.05, far: 100 }}
        onCreated={(state) => {
          // For profiling from the browser console during development.
          if (import.meta.env.DEV) Object.assign(window, { __atlas: state })
          const canvas = state.gl.domElement
          canvas.addEventListener('webglcontextlost', (e) => {
            // Asks the browser to give the context back when it can.
            e.preventDefault()
            setContextLost(true)
          })
          canvas.addEventListener('webglcontextrestored', () => setContextLost(false))
        }}
      >
        {/* Drops the resolution when the frame rate can't keep up, and raises it again when it can. */}
        {quality === 'auto' && (
          <PerformanceMonitor
            flipflops={4}
            onChange={({ factor }) => setAutoDpr(Math.round((MIN_DPR + (MAX_DPR - MIN_DPR) * factor) * 10) / 10)}
          />
        )}
        <World />
      </Canvas>
      <Hud />
      <Overlays />
      {contextLost && (
        <GraphicsProblem
          title="The 3D view stopped"
          detail="The browser paused the graphics, which can happen after a driver reset or with many tabs open. It may come back by itself; if not, reload to carry on."
        />
      )}
    </GraphicsErrorBoundary>
  )
}
