import { Canvas } from '@react-three/fiber'
import { useCallback, useState } from 'react'
import { GraphicsErrorBoundary, GraphicsProblem } from './components/GraphicsProblem.tsx'
import { Hud } from './components/Hud.tsx'
import { Overlays } from './components/Overlays.tsx'
import { FocusBadge } from './features/study/FocusBadge.tsx'
import { FrameScheduler } from './world/FrameScheduler.tsx'
import { useSavingBattery, useSettings } from './world/settings.ts'
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
/** How much the resolution moves at a time in Auto, and how many times it may go back up before it settles. */
const DPR_STEP = 0.25
const MAX_RISES = 3

export default function App() {
  const [autoDpr, setAutoDpr] = useState(MAX_DPR)
  const [rises, setRises] = useState(0)
  const quality = useSettings((s) => s.quality)
  const saving = useSavingBattery()
  const chosen = quality === 'auto' ? autoDpr : quality === 'high' ? MAX_DPR : LOW_DPR
  // Battery saver draws at most one pixel per screen point, a quarter of a Retina screen's.
  const dpr = saving ? Math.min(chosen, MIN_DPR) : chosen
  // Drops the resolution when frames can't keep up, and raises it again when they can, a few times at most.
  const onPace = useCallback(
    (pace: 'slow' | 'fast') => {
      if (quality !== 'auto') return
      if (pace === 'slow') setAutoDpr((d) => Math.max(MIN_DPR, d - DPR_STEP))
      else if (rises < MAX_RISES && autoDpr < MAX_DPR) {
        setAutoDpr((d) => Math.min(MAX_DPR, d + DPR_STEP))
        setRises((r) => r + 1)
      }
    },
    [quality, rises, autoDpr],
  )
  // The browser can take the graphics context away (a driver reset, or too many tabs using WebGL).
  const [contextLost, setContextLost] = useState(false)
  return (
    <GraphicsErrorBoundary>
      <Canvas
        shadows="percentage"
        dpr={dpr}
        // Lets laptops with two graphics chips use the economical one; the world is light enough for it.
        gl={{ powerPreference: 'default' }}
        frameloop="never"
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
        <FrameScheduler onPace={onPace} />
        <World />
      </Canvas>
      <Hud />
      <FocusBadge />
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
