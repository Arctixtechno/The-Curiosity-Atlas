import { Canvas } from '@react-three/fiber'
import { Hud } from './components/Hud.tsx'
import { World } from './world/World.tsx'

export default function App() {
  return (
    <>
      <Canvas shadows="percentage" dpr={[1, 2]} camera={{ fov: 70, near: 0.05, far: 100 }}>
        <World />
      </Canvas>
      <Hud />
    </>
  )
}
