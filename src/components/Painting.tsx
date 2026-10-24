import { useMemo } from 'react'
import { getPainting, type PaintingName } from './paintings.ts'
import { Glow } from './Glow.tsx'

interface PaintingProps {
  name: PaintingName
  position: [number, number, number]
  rotationY: number
  /** Width of the canvas in metres; height follows the 4:3 painting. */
  width?: number
}

/** A framed painting with a brass picture light above it. Faces local +z. */
export function Painting({ name, position, rotationY, width = 1.2 }: PaintingProps) {
  const map = useMemo(() => getPainting(name), [name])
  const height = width * 0.75
  const frame = 0.09
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh position={[0, 0, 0.03]} castShadow>
        <boxGeometry args={[width + frame * 2, height + frame * 2, 0.06]} />
        <meshStandardMaterial color="#b08a4a" metalness={0.75} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0, 0.055]}>
        <boxGeometry args={[width + 0.05, height + 0.05, 0.02]} />
        <meshStandardMaterial color="#6e5228" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0, 0.067]}>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial map={map} roughness={0.7} />
      </mesh>
      {/* Picture light. */}
      <group position={[0, height / 2 + frame + 0.12, 0.12]}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.03, 0.03, width * 0.6, 12]} />
          <meshStandardMaterial color="#b08d57" metalness={0.85} roughness={0.25} />
        </mesh>
        <mesh position={[0, 0, -0.07]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.012, 0.012, 0.14, 6]} />
          <meshStandardMaterial color="#b08d57" metalness={0.85} roughness={0.25} />
        </mesh>
      </group>
      <Glow position={[0, height * 0.12, 0.072]} size={[width * 1.25, height * 1.3]} color="#ffd8a0" opacity={0.28} />
    </group>
  )
}
