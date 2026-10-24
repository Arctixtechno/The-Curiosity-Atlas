import { Canvas } from '@react-three/fiber'
import { useState } from 'react'
import { Hud } from './components/Hud.tsx'
import { World } from './world/World.tsx'

export default function App() {
  const [isExploring, setIsExploring] = useState(false)

  return (
    <>
      <Canvas shadows dpr={[1, 2]} camera={{ fov: 70, near: 0.05, far: 100 }}>
        <World onLockChange={setIsExploring} />
      </Canvas>
      <Hud isExploring={isExploring} />
    </>
  )
}
