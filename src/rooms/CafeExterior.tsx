import { Label3D } from '../components/Label3D.tsx'
import { CAFE } from './dimensions.ts'

/**
 * Lightweight outside of the café, shown from the courtyard. The interior
 * arrives in a later phase.
 */
export function CafeExterior() {
  const centerZ = CAFE.frontZ + CAFE.depth / 2
  return (
    <group>
      <mesh position={[0, CAFE.height / 2, centerZ]} castShadow receiveShadow>
        <boxGeometry args={[CAFE.width, CAFE.height, CAFE.depth]} />
        <meshStandardMaterial color="#e2cfae" roughness={0.9} />
      </mesh>
      <mesh position={[0, CAFE.height - 0.6, CAFE.frontZ - 0.6]} rotation={[0.35, 0, 0]} castShadow>
        <boxGeometry args={[CAFE.width - 0.4, 0.08, 1.4]} />
        <meshStandardMaterial color="#1f4a3c" roughness={0.8} />
      </mesh>
      {[-2.6, 2.6].map((x) => (
        <mesh key={x} position={[x, 1.5, CAFE.frontZ - 0.01]} rotation={[0, Math.PI, 0]}>
          <planeGeometry args={[1.6, 1.2]} />
          <meshStandardMaterial color="#ffd89a" emissive="#ffb950" emissiveIntensity={0.6} />
        </mesh>
      ))}
      <group rotation={[0, Math.PI, 0]}>
        <Label3D text="Café" position={[0, CAFE.height + 0.4, -CAFE.frontZ + 0.02]} scale={2.5} />
      </group>
    </group>
  )
}
