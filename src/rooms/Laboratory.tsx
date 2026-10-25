import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { CanvasTexture, SRGBColorSpace, Vector3, type Group } from 'three'
import { BUOYANCY_OVERLAY, GAS_OVERLAY } from '../features/experiments/overlayIds.ts'
import { useSurfaceTexture, useTiledTexture } from '../hooks/useTiledTexture.ts'
import { useInteractable } from '../world/InteractionSystem.tsx'
import { openOverlay } from '../world/overlay.ts'
import { Atmosphere } from './Atmosphere.tsx'
import { LABORATORY } from './dimensions.ts'
import { RoomShell } from './RoomShell.tsx'

const { width: W, length: L, height: H, bench: BENCH } = LABORATORY
const BRASS = { color: '#d4b064', metalness: 0.55, roughness: 0.3 }
const SLATE = { color: '#2e3236', roughness: 0.55 }
/** Clear glass without `transmission`, which would re-render the room every frame. */
const GLASS = { color: '#dceef5', transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0.1, depthWrite: false }
const DADO_HEIGHT = 1.3

/** Glazed tiles on the lower part of every wall, capped with a wooden rail. */
function Dado() {
  const sides = [
    { position: [0, 0, -L / 2 + 0.01], rotationY: 0, length: W },
    { position: [-W / 2 + 0.01, 0, 0], rotationY: Math.PI / 2, length: L },
    { position: [W / 2 - 0.01, 0, 0], rotationY: -Math.PI / 2, length: L },
    { position: [0, 0, L / 2 - 0.01], rotationY: Math.PI, length: W },
  ] as const
  return (
    <>
      {sides.map((s, i) => (
        <DadoSide key={i} seed={i} {...s} />
      ))}
    </>
  )
}

function DadoSide({
  position,
  rotationY,
  length,
  seed,
}: {
  position: readonly number[]
  rotationY: number
  length: number
  seed: number
}) {
  const tiles = useSurfaceTexture('glazed', length, DADO_HEIGHT, 40 + seed, 200)
  return (
    <group position={position as [number, number, number]} rotation={[0, rotationY, 0]}>
      <mesh position={[0, DADO_HEIGHT / 2, 0]}>
        <planeGeometry args={[length, DADO_HEIGHT]} />
        <meshStandardMaterial map={tiles} roughness={0.25} />
      </mesh>
      <mesh position={[0, DADO_HEIGHT, 0.02]}>
        <boxGeometry args={[length, 0.06, 0.05]} />
        <meshStandardMaterial color="#5a3a24" roughness={0.5} />
      </mesh>
    </group>
  )
}

/** A teak cabinet with a slate top, the base of each experiment station. */
function Bench({ at, children }: { at: [number, number]; children?: React.ReactNode }) {
  const wood = useTiledTexture('wood', 2, 1)
  return (
    <group position={[at[0], 0, at[1]]}>
      <mesh position={[0, (BENCH.height - 0.05) / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[BENCH.width - 0.1, BENCH.height - 0.05, BENCH.depth - 0.1]} />
        <meshStandardMaterial color="#e0b088" map={wood} roughness={0.55} />
      </mesh>
      {/* Drawer fronts with brass pulls, on the side facing the room. */}
      {[-0.7, 0, 0.7].map((x) => (
        <group key={x} position={[x, BENCH.height - 0.25, BENCH.depth / 2 - 0.04]}>
          <mesh>
            <boxGeometry args={[0.62, 0.22, 0.02]} />
            <meshStandardMaterial color="#c8966c" map={wood} roughness={0.5} />
          </mesh>
          <mesh position={[0, 0, 0.02]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.012, 0.012, 0.12, 8]} />
            <meshStandardMaterial {...BRASS} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, BENCH.height - 0.025, 0]} castShadow receiveShadow>
        <boxGeometry args={[BENCH.width, 0.05, BENCH.depth]} />
        <meshStandardMaterial {...SLATE} />
      </mesh>
      <group position={[0, BENCH.height, 0]}>{children}</group>
    </group>
  )
}

/** A dial gauge: brass rim, white face and a needle. */
function Gauge({
  position,
  rotation,
  needle = 0.3,
}: {
  position: [number, number, number]
  rotation?: [number, number, number]
  needle?: number
}) {
  return (
    <group position={position} rotation={rotation}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.11, 0.11, 0.04, 32]} />
        <meshStandardMaterial {...BRASS} />
      </mesh>
      <mesh position={[0, 0, 0.021]}>
        <circleGeometry args={[0.095, 32]} />
        <meshStandardMaterial color="#f2ece0" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0, 0.024]} rotation={[0, 0, needle]}>
        <boxGeometry args={[0.008, 0.16, 0.002]} />
        <meshStandardMaterial color="#b0301c" />
      </mesh>
    </group>
  )
}

/** The piston apparatus: a glass cylinder over a burner, a brass piston that rises and falls, and a pressure gauge. */
function GasStation() {
  const [x, z] = LABORATORY.gasBench
  useInteractable({
    position: useMemo(() => new Vector3(x, 1.2, z), [x, z]),
    radius: 2,
    prompt: 'Press E to experiment with gas pressure',
    onInteract: () => openOverlay(GAS_OVERLAY),
  })
  const piston = useRef<Group>(null)
  // The piston drifts gently, as if the gas were warming and cooling.
  useFrame(({ clock }) => {
    if (piston.current) piston.current.position.y = 0.42 + Math.sin(clock.elapsedTime * 0.6) * 0.08
  })
  return (
    <Bench at={LABORATORY.gasBench}>
      <group position={[-0.3, 0, 0]}>
        {/* Iron stand and burner. */}
        <mesh position={[0, 0.06, 0]}>
          <cylinderGeometry args={[0.2, 0.22, 0.12, 24]} />
          <meshStandardMaterial color="#2a2c30" metalness={0.5} roughness={0.5} />
        </mesh>
        {/* A low blue flame. */}
        <mesh position={[0, 0.16, 0]}>
          <coneGeometry args={[0.05, 0.08, 16]} />
          <meshBasicMaterial color="#5aa0ff" transparent opacity={0.8} toneMapped={false} />
        </mesh>
        <mesh position={[0, 0.5, 0]}>
          <cylinderGeometry args={[0.16, 0.16, 0.7, 32, 1, true]} />
          <meshStandardMaterial {...GLASS} side={2} />
        </mesh>
        <mesh position={[0, 0.15, 0]}>
          <cylinderGeometry args={[0.165, 0.165, 0.02, 32]} />
          <meshStandardMaterial {...BRASS} />
        </mesh>
        <group ref={piston}>
          <mesh>
            <cylinderGeometry args={[0.155, 0.155, 0.05, 32]} />
            <meshStandardMaterial {...BRASS} />
          </mesh>
          <mesh position={[0, 0.3, 0]}>
            <cylinderGeometry args={[0.015, 0.015, 0.6, 8]} />
            <meshStandardMaterial {...BRASS} />
          </mesh>
          <mesh position={[0, 0.6, 0]}>
            <sphereGeometry args={[0.04, 12, 8]} />
            <meshStandardMaterial color="#1c1c1c" roughness={0.4} />
          </mesh>
        </group>
        {/* Pipe to the gauge. */}
        <mesh position={[0.32, 0.22, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.012, 0.012, 0.32, 8]} />
          <meshStandardMaterial {...BRASS} />
        </mesh>
        <mesh position={[0.48, 0.38, 0]}>
          <cylinderGeometry args={[0.012, 0.012, 0.32, 8]} />
          <meshStandardMaterial {...BRASS} />
        </mesh>
      </group>
      <Gauge position={[0.18, 0.62, 0]} needle={-0.6} />
      {/* A notebook beside it. */}
      <mesh position={[0.65, 0.01, 0.1]} rotation={[0, -0.25, 0]}>
        <boxGeometry args={[0.3, 0.02, 0.22]} />
        <meshStandardMaterial color="#6a2c22" roughness={0.8} />
      </mesh>
    </Bench>
  )
}

/** The buoyancy tank: a glass tank of water with a block floating in it, and blocks of other materials beside it. */
function BuoyancyStation() {
  const [x, z] = LABORATORY.buoyancyBench
  useInteractable({
    position: useMemo(() => new Vector3(x, 1.2, z), [x, z]),
    radius: 2,
    prompt: 'Press E to try the buoyancy tank',
    onInteract: () => openOverlay(BUOYANCY_OVERLAY),
  })
  const block = useRef<Group>(null)
  useFrame(({ clock }) => {
    if (block.current) block.current.position.y = 0.36 + Math.sin(clock.elapsedTime * 1.3) * 0.008
  })
  const tank = { w: 0.8, h: 0.45, d: 0.45 }
  return (
    <Bench at={LABORATORY.buoyancyBench}>
      <group position={[-0.35, 0, 0]}>
        <mesh position={[0, tank.h / 2, 0]}>
          <boxGeometry args={[tank.w, tank.h, tank.d]} />
          <meshStandardMaterial {...GLASS} side={2} />
        </mesh>
        <mesh position={[0, 0.17, 0]}>
          <boxGeometry args={[tank.w - 0.02, 0.34, tank.d - 0.02]} />
          <meshStandardMaterial color="#4f8fb4" transparent opacity={0.45} roughness={0.1} depthWrite={false} />
        </mesh>
        {/* Wooden block floating with about half of it under. */}
        <group ref={block}>
          <mesh>
            <boxGeometry args={[0.1, 0.1, 0.1]} />
            <meshStandardMaterial color="#d9b27a" roughness={0.7} />
          </mesh>
        </group>
        {/* Brass frame round the tank's edges. */}
        {[-1, 1].map((sx) =>
          [-1, 1].map((sz) => (
            <mesh key={`${sx}${sz}`} position={[(sx * tank.w) / 2, tank.h / 2, (sz * tank.d) / 2]}>
              <boxGeometry args={[0.02, tank.h, 0.02]} />
              <meshStandardMaterial {...BRASS} />
            </mesh>
          )),
        )}
      </group>
      {/* Sample blocks: cork, ice, aluminium, steel, gold. */}
      {[
        ['#b98d5c', 0.2],
        ['#e6f4fb', 0.33],
        ['#c9ced4', 0.46],
        ['#7c8590', 0.59],
        ['#e2b84a', 0.72],
      ].map(([colour, bx]) => (
        <mesh key={colour} position={[bx as number, 0.05, 0.15]} castShadow>
          <boxGeometry args={[0.1, 0.1, 0.1]} />
          <meshStandardMaterial color={colour as string} roughness={0.4} metalness={(bx as number) > 0.4 ? 0.6 : 0} />
        </mesh>
      ))}
    </Bench>
  )
}

/** A chalkboard with the two laws written up, for the wall between the benches. */
function paintChalkboard() {
  const w = 1024
  const h = 512
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#26302b'
  ctx.fillRect(0, 0, w, h)
  // Smudges of old chalk.
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * w
    const y = Math.random() * h
    const g = ctx.createRadialGradient(x, y, 0, x, y, 60 + Math.random() * 80)
    g.addColorStop(0, 'rgba(255, 255, 255, 0.05)')
    g.addColorStop(1, 'rgba(255, 255, 255, 0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
  }
  ctx.fillStyle = 'rgba(240, 240, 230, 0.9)'
  ctx.font = 'italic 64px Georgia, serif'
  ctx.fillText('pV = nRT', 70, 130)
  ctx.font = 'italic 40px Georgia, serif'
  ctx.fillText('R = 8.314 J/(mol·K)', 70, 190)
  ctx.font = 'italic 64px Georgia, serif'
  ctx.fillText('F = ρ g V', 560, 130)
  ctx.font = 'italic 40px Georgia, serif'
  ctx.fillText('Archimedes, c. 250 BC', 560, 190)
  // A sketch of a piston and of a floating block.
  ctx.strokeStyle = 'rgba(240, 240, 230, 0.8)'
  ctx.lineWidth = 4
  ctx.strokeRect(120, 260, 140, 200)
  ctx.strokeRect(120, 330, 140, 12)
  ctx.beginPath()
  ctx.moveTo(190, 330)
  ctx.lineTo(190, 240)
  ctx.stroke()
  ctx.strokeRect(600, 300, 300, 160)
  ctx.beginPath()
  ctx.moveTo(600, 350)
  for (let x = 600; x <= 900; x += 20) ctx.lineTo(x, 350 + Math.sin(x / 12) * 4)
  ctx.stroke()
  ctx.strokeRect(720, 320, 60, 60)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

function Chalkboard() {
  const texture = useMemo(paintChalkboard, [])
  useEffect(() => () => texture.dispose(), [texture])
  return (
    <group position={[0, 2.25, -L / 2 + 0.05]}>
      <mesh>
        <boxGeometry args={[3.1, 1.6, 0.05]} />
        <meshStandardMaterial color="#5a3a24" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0, 0.03]}>
        <planeGeometry args={[2.95, 1.45]} />
        <meshStandardMaterial map={texture} roughness={0.95} />
      </mesh>
    </group>
  )
}

/** Shelves of glassware along the far wall either side of the chalkboard. */
function Shelves() {
  const wood = useTiledTexture('wood', 2, 1)
  const colours = ['#7fc7a4', '#e0a458', '#8fb8e8', '#d0607a', '#c8d8e0']
  return (
    <>
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 3.4, 0, -L / 2 + 0.25]}>
          {[0.9, 1.55, 2.2].map((y, row) => (
            <group key={y} position={[0, y, 0]}>
              <mesh castShadow receiveShadow>
                <boxGeometry args={[2.4, 0.04, 0.4]} />
                <meshStandardMaterial color="#7a4c2c" map={wood} roughness={0.55} />
              </mesh>
              {Array.from({ length: 6 }, (_, i) => {
                const fx = -1 + i * 0.4 + (row % 2) * 0.12
                const colour = colours[(i + row * 2 + (side > 0 ? 1 : 0)) % colours.length]
                const round = (i + row) % 3 === 0
                return (
                  <group key={i} position={[fx, 0.02, 0]}>
                    {/* The liquid inside, then the glass round it. */}
                    <mesh position={[0, round ? 0.08 : 0.07, 0]}>
                      {round ? <sphereGeometry args={[0.07, 16, 12]} /> : <cylinderGeometry args={[0.045, 0.045, 0.12, 16]} />}
                      <meshStandardMaterial color={colour} emissive={colour} emissiveIntensity={0.15} roughness={0.2} />
                    </mesh>
                    <mesh position={[0, round ? 0.1 : 0.11, 0]}>
                      {round ? (
                        <sphereGeometry args={[0.09, 16, 12]} />
                      ) : (
                        <cylinderGeometry args={[0.05, 0.05, 0.22, 16, 1, true]} />
                      )}
                      <meshStandardMaterial {...GLASS} />
                    </mesh>
                    {round && (
                      <mesh position={[0, 0.22, 0]}>
                        <cylinderGeometry args={[0.025, 0.03, 0.1, 12, 1, true]} />
                        <meshStandardMaterial {...GLASS} />
                      </mesh>
                    )}
                  </group>
                )
              })}
            </group>
          ))}
          {/* Brackets. */}
          {[-1.1, 1.1].map((bx) => (
            <mesh key={bx} position={[bx, 1.55, -0.12]}>
              <boxGeometry args={[0.04, 1.4, 0.12]} />
              <meshStandardMaterial {...BRASS} />
            </mesh>
          ))}
        </group>
      ))}
    </>
  )
}

/** Brass pendant lamps with opal glass shades. */
function Pendant({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, H, z]}>
      <mesh position={[0, -0.4, 0]}>
        <cylinderGeometry args={[0.01, 0.01, 0.8, 6]} />
        <meshStandardMaterial {...BRASS} />
      </mesh>
      <mesh position={[0, -0.85, 0]}>
        <sphereGeometry args={[0.16, 20, 12, 0, Math.PI * 2, 0, Math.PI / 1.6]} />
        <meshStandardMaterial color="#f4ecdc" emissive="#ffe2b0" emissiveIntensity={1.4} side={2} />
      </mesh>
      <pointLight position={[0, -1, 0]} color="#ffe6c4" intensity={8} distance={10} decay={1.5} />
    </group>
  )
}

/** The Experimental Laboratory: two stations that open live, physically accurate experiments. */
export default function Laboratory() {
  return (
    <group>
      <Atmosphere background="#0c0a08" />
      <hemisphereLight args={['#fff0dc', '#3a2c20', 0.7]} />
      <RoomShell
        width={W}
        length={L}
        height={H}
        floor={{ color: '#ffffff', texture: 'chequer' }}
        walls={{ color: '#ece8de', texture: 'plaster' }}
        ceiling={{ color: '#e8e2d4', texture: 'plaster' }}
      />
      <Dado />
      <GasStation />
      <BuoyancyStation />
      <Chalkboard />
      <Shelves />
      <Pendant x={-2.6} z={-2} />
      <Pendant x={2.6} z={-2} />
      <Pendant x={0} z={2.5} />
    </group>
  )
}
