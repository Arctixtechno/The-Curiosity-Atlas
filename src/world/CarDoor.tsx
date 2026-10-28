import { useEffect, useMemo } from 'react'
import { ExtrudeGeometry, Shape, Vector3 } from 'three'
import { Label3D } from '../components/Label3D.tsx'
import { CAR } from '../rooms/dimensions.ts'
import type { DoorDefinition } from '../types/room.ts'
import { usePreloadNear } from './Door.tsx'
import { useInteractable } from './InteractionSystem.tsx'
import { travelThrough } from './travel.ts'

// Low metalness: with no environment map to reflect, metallic paint renders nearly black.
const PAINT = { color: '#2f5c45', metalness: 0.15, roughness: 0.38 }
const TRIM = { color: '#1c1c1f', roughness: 0.6 }
const GLASS = { color: '#7f98a8', metalness: 0.2, roughness: 0.08 }
const WHEEL_X = 1.45
const WHEEL_R = 0.34

/** A side profile, as [x, y] points along the car's length, extruded across its width. */
function useProfile(points: [number, number][], width: number) {
  const geometry = useMemo(() => {
    const shape = new Shape()
    points.forEach(([x, y], i) => (i ? shape.lineTo(x, y) : shape.moveTo(x, y)))
    shape.closePath()
    const g = new ExtrudeGeometry(shape, { depth: width, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 2 })
    g.translate(0, 0, -width / 2)
    return g
  }, [points, width])
  useEffect(() => () => geometry.dispose(), [geometry])
  return geometry
}

/** Body: a long bonnet sloping to the bumper, and a squared-off estate tail. */
const BODY: [number, number][] = [
  [-2.22, 0.36],
  [2.2, 0.36],
  [2.25, 0.72],
  [1.25, 0.96],
  [-2.2, 0.98],
  [-2.25, 0.7],
]
/** The glasshouse: raked windscreen, upright estate tailgate. */
const CABIN: [number, number][] = [
  [-2.12, 0.96],
  [1.15, 0.96],
  [0.45, 1.5],
  [-2.05, 1.5],
]

/**
 * A car parked where a door would be, for places you drive to. Getting in
 * starts the drive. The car is drawn in the door's local space: its length
 * runs along the wall, and the driver's side faces the room.
 */
export function CarDoor({ door }: { door: DoorDefinition }) {
  const { target } = door
  const center = useMemo(() => {
    const [x, , z] = door.position
    return new Vector3(x - Math.sin(door.rotationY) * CAR.offset, 1, z - Math.cos(door.rotationY) * CAR.offset)
  }, [door.position, door.rotationY])

  useInteractable({
    position: center,
    radius: 3.4,
    prompt: door.prompt ?? `Press E to drive to the ${door.label}`,
    onInteract: target ? () => void travelThrough(door) : undefined,
  })
  usePreloadNear(door, center)
  const body = useProfile(BODY, CAR.width - 0.08)
  const cabin = useProfile(CABIN, CAR.width - 0.26)

  return (
    <group position={door.position} rotation={[0, door.rotationY, 0]}>
      <group position={[0, 0, -CAR.offset]}>
        {/* A soft dark patch under the car, so it sits on the ground. */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
          <planeGeometry args={[CAR.length + 0.4, CAR.width + 0.3]} />
          <meshBasicMaterial color="#000" transparent opacity={0.35} depthWrite={false} />
        </mesh>
        {/* Body, then the glasshouse and roof. */}
        <mesh geometry={body} castShadow>
          <meshPhysicalMaterial {...PAINT} clearcoat={1} clearcoatRoughness={0.15} />
        </mesh>
        <mesh geometry={cabin} castShadow>
          <meshPhysicalMaterial {...GLASS} clearcoat={1} />
        </mesh>
        <mesh position={[-0.8, 1.55, 0]} castShadow>
          <boxGeometry args={[2.6, 0.06, CAR.width - 0.14]} />
          <meshPhysicalMaterial {...PAINT} clearcoat={1} clearcoatRoughness={0.15} />
        </mesh>
        {/* Pillars between the side windows. */}
        {[-1.95, -0.85, 0.25].map((x) => (
          <mesh key={x} position={[x, 1.23, 0]}>
            <boxGeometry args={[0.1, 0.56, CAR.width - 0.18]} />
            <meshPhysicalMaterial {...PAINT} clearcoat={1} />
          </mesh>
        ))}
        {/* Bumpers, lights and roof bars. */}
        {[-1, 1].map((end) => (
          <group key={end}>
            <mesh position={[end * (CAR.length / 2 + 0.04), 0.48, 0]}>
              <boxGeometry args={[0.1, 0.18, CAR.width + 0.04]} />
              <meshStandardMaterial {...TRIM} />
            </mesh>
            {[-0.62, 0.62].map((z) => (
              <mesh key={z} position={[end * (CAR.length / 2 + 0.005), 0.78, z]}>
                <boxGeometry args={[0.02, 0.14, 0.32]} />
                <meshStandardMaterial
                  color={end > 0 ? '#fff6dc' : '#ff3a2a'}
                  emissive={end > 0 ? '#fff0c8' : '#ff2a1a'}
                  emissiveIntensity={end > 0 ? 2.2 : 1.2}
                />
              </mesh>
            ))}
          </group>
        ))}
        {[-0.7, 0.7].map((z) => (
          <mesh key={z} position={[-0.8, 1.62, z]}>
            <boxGeometry args={[2.4, 0.05, 0.05]} />
            <meshStandardMaterial color="#9a9ca0" metalness={0.6} roughness={0.4} />
          </mesh>
        ))}
        {/* Door handle and line on the driver's side. */}
        <mesh position={[0.2, 0.86, CAR.width / 2 + 0.005]}>
          <boxGeometry args={[0.2, 0.04, 0.02]} />
          <meshStandardMaterial color="#c9c9cc" metalness={0.7} roughness={0.3} />
        </mesh>
        {/* Wheels. */}
        {[-WHEEL_X, WHEEL_X].flatMap((x) =>
          [-1, 1].map((side) => (
            <group key={`${x},${side}`} position={[x, WHEEL_R, side * (CAR.width / 2 - 0.08)]} rotation={[Math.PI / 2, 0, 0]}>
              <mesh castShadow>
                <cylinderGeometry args={[WHEEL_R, WHEEL_R, 0.24, 20]} />
                <meshStandardMaterial color="#111" roughness={0.9} />
              </mesh>
              <mesh position={[0, side * 0.125, 0]}>
                <cylinderGeometry args={[0.18, 0.18, 0.02, 16]} />
                <meshStandardMaterial color="#b8bac0" metalness={0.7} roughness={0.3} />
              </mesh>
            </group>
          )),
        )}
      </group>
      <Label3D text={door.label} position={[0, 2.2, -CAR.offset]} scale={1.3} />
    </group>
  )
}
