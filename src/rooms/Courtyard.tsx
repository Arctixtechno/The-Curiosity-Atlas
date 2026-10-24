import { COURTYARD } from './dimensions.ts'
import { RoomShell } from './RoomShell.tsx'
import { Atmosphere } from './Atmosphere.tsx'

function Tree({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.3, 0]} castShadow>
        <boxGeometry args={[0.8, 0.6, 0.8]} />
        <meshStandardMaterial color="#8a7a66" roughness={0.9} />
      </mesh>
      <mesh position={[0, 1.2, 0]} castShadow>
        <cylinderGeometry args={[0.1, 0.14, 1.4, 8]} />
        <meshStandardMaterial color="#5a3d26" />
      </mesh>
      <mesh position={[0, 2.4, 0]} castShadow>
        <sphereGeometry args={[0.9, 16, 12]} />
        <meshStandardMaterial color="#4f7a3a" roughness={0.9} />
      </mesh>
    </group>
  )
}

/** Placeholder courtyard: a small walled garden outside the entrance, with the café at the far end. */
export default function Courtyard() {
  return (
    <group>
      <Atmosphere background="#e9b98a" fog={[25, 60]} />
      <hemisphereLight args={['#ffe3c0', '#4c5a36', 1.1]} />
      <directionalLight position={[8, 12, -4]} intensity={2.2} color="#ffd2a0" castShadow />

      <RoomShell
        width={COURTYARD.width}
        length={COURTYARD.length}
        height={COURTYARD.hedgeHeight}
        floor={{ color: '#ffffff', texture: 'stone', scale: 3 }}
        walls={{ color: '#5f8a44', texture: 'fabric', scale: 0.8 }}
        wallThickness={0.4}
      />
      {/* The house wall the entrance door sits in. */}
      <mesh position={[0, 2.2, -COURTYARD.length / 2 - 0.2]}>
        <boxGeometry args={[COURTYARD.width + 0.8, 4.4, 0.4]} />
        <meshStandardMaterial color="#d8c7a8" roughness={0.95} />
      </mesh>

      <Tree x={-4.5} z={-2} />
      <Tree x={4.5} z={-2} />
    </group>
  )
}
