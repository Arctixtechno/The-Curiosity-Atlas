import { useMemo } from 'react'
import { Vector3 } from 'three'
import { Bookcase } from '../components/Bookcase.tsx'
import { CornerShading } from '../components/Mouldings.tsx'
import { Painting } from '../components/Painting.tsx'
import { useTiledTexture } from '../hooks/useTiledTexture.ts'
import { useLibrary } from '../services/library.ts'
import { useInteractable } from '../world/InteractionSystem.tsx'
import { openOverlay } from '../world/overlay.ts'
import { Atmosphere } from './Atmosphere.tsx'
import { LIBRARY } from './dimensions.ts'
import { RoomShell } from './RoomShell.tsx'

// The Library: a tall reading room lined floor to ceiling with books, a
// rolling ladder on a brass rail, a long reading table under green banker's
// lamps, and at the far end a desk where your own saved discoveries are kept.

const { width: W, length: L, height: H } = LIBRARY
const OAK = '#4e321e'
const DARK_OAK = '#2e1c10'
const BRASS = { color: '#c9a25a', metalness: 0.8, roughness: 0.3 }
const LAMP_GREEN = '#1f5a3a'
/** The tall cases: shelves every 46 cm up to just under the cornice. */
const TALL_SHELVES = [0.42, 0.88, 1.34, 1.8, 2.26, 2.72, 3.18]
const CASE_HEIGHT = 3.6
/** Height of the brass rail the ladder hangs from. */
const RAIL_Y = 3.3

/** A brass rail along the left-hand cases, and an oak ladder hooked onto it. */
function Ladder() {
  const z = 1.4
  const x = -W / 2 + 0.4
  const rungs = 11
  const top = RAIL_Y
  // Leaning out from the rail: its feet stand about 0.9 m from the shelves.
  const lean = Math.atan2(0.85, top)
  return (
    <group>
      <mesh position={[x - 0.04, RAIL_Y, LIBRARY.sideCases.z]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.018, 0.018, LIBRARY.sideCases.length - 0.2, 10]} />
        <meshStandardMaterial {...BRASS} />
      </mesh>
      <group position={[x - 0.04, top, z]} rotation={[0, 0, lean]}>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[0, -top / 2 / Math.cos(lean), s * 0.22]} castShadow>
            <boxGeometry args={[0.05, top / Math.cos(lean), 0.04]} />
            <meshStandardMaterial color={OAK} roughness={0.55} />
          </mesh>
        ))}
        {Array.from({ length: rungs }, (_, i) => (
          <mesh key={i} position={[0, -((i + 0.6) * top) / rungs / Math.cos(lean), 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.016, 0.016, 0.44, 8]} />
            <meshStandardMaterial color={OAK} roughness={0.55} />
          </mesh>
        ))}
        {/* The hooks over the rail, and the brass wheels at its feet. */}
        {[-1, 1].map((s) => (
          <mesh key={`h${s}`} position={[0.02, 0.03, s * 0.22]}>
            <torusGeometry args={[0.03, 0.008, 6, 12, Math.PI]} />
            <meshStandardMaterial {...BRASS} />
          </mesh>
        ))}
      </group>
      {[-1, 1].map((s) => (
        <mesh key={`w${s}`} position={[x - 0.04 + 0.85, 0.035, z + s * 0.22]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.035, 0.035, 0.02, 14]} />
          <meshStandardMaterial {...BRASS} />
        </mesh>
      ))}
    </group>
  )
}

/** A banker's lamp: brass stem and a green glass shade glowing from beneath. */
function BankersLamp({ position, light = true }: { position: [number, number, number]; light?: boolean }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.012, 0]}>
        <cylinderGeometry args={[0.07, 0.08, 0.024, 16]} />
        <meshStandardMaterial {...BRASS} />
      </mesh>
      <mesh position={[0, 0.17, 0]}>
        <cylinderGeometry args={[0.01, 0.01, 0.3, 8]} />
        <meshStandardMaterial {...BRASS} />
      </mesh>
      {/* The shade lies on its side, a half tube open underneath. */}
      <mesh position={[0, 0.33, 0.04]} rotation={[0.25, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.07, 0.07, 0.32, 16, 1, true, 0, Math.PI]} />
        <meshStandardMaterial color={LAMP_GREEN} roughness={0.25} metalness={0.2} side={2} emissive="#0c3a20" />
      </mesh>
      <mesh position={[0, 0.325, 0.04]}>
        <boxGeometry args={[0.26, 0.012, 0.05]} />
        <meshBasicMaterial color="#fff0c8" toneMapped={false} />
      </mesh>
      {light && <pointLight position={[0, 0.25, 0.15]} color="#ffd9a0" intensity={2.6} distance={3.2} decay={1.6} />}
    </group>
  )
}

/** A plain oak library chair: seat, four legs and a slatted back. */
function Chair({ position, rotationY }: { position: [number, number, number]; rotationY: number }) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh position={[0, 0.46, 0]} castShadow>
        <boxGeometry args={[0.44, 0.04, 0.42]} />
        <meshStandardMaterial color={OAK} roughness={0.55} />
      </mesh>
      <mesh position={[0, 0.48, 0]}>
        <boxGeometry args={[0.38, 0.02, 0.36]} />
        <meshStandardMaterial color="#5a2418" roughness={0.6} />
      </mesh>
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} position={[sx * 0.19, 0.23, sz * 0.18]}>
            <boxGeometry args={[0.035, 0.46, 0.035]} />
            <meshStandardMaterial color={OAK} roughness={0.55} />
          </mesh>
        )),
      )}
      {[-1, 1].map((sx) => (
        <mesh key={sx} position={[sx * 0.19, 0.72, -0.19]}>
          <boxGeometry args={[0.035, 0.52, 0.035]} />
          <meshStandardMaterial color={OAK} roughness={0.55} />
        </mesh>
      ))}
      {[0.62, 0.82, 0.96].map((y) => (
        <mesh key={y} position={[0, y, -0.19]}>
          <boxGeometry args={[0.38, y > 0.9 ? 0.07 : 0.03, 0.025]} />
          <meshStandardMaterial color={OAK} roughness={0.55} />
        </mesh>
      ))}
    </group>
  )
}

/** The long reading table, with lamps, chairs either side and a few books left open. */
function ReadingTable() {
  const { at, width, length } = LIBRARY.table
  const leather = useTiledTexture('leather', 2, 1)
  return (
    <group position={[at[0], 0, at[1]]}>
      <mesh position={[0, 0.74, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, 0.05, length]} />
        <meshStandardMaterial color={OAK} roughness={0.4} />
      </mesh>
      {/* A tooled leather writing surface let into the top. */}
      <mesh position={[0, 0.766, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width - 0.2, length - 0.3]} />
        <meshStandardMaterial color="#26402e" map={leather} roughness={0.6} />
      </mesh>
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} position={[sx * (width / 2 - 0.08), 0.36, sz * (length / 2 - 0.1)]}>
            <cylinderGeometry args={[0.04, 0.03, 0.72, 10]} />
            <meshStandardMaterial color={DARK_OAK} roughness={0.5} />
          </mesh>
        )),
      )}
      {[-1, 1].map((sz) => (
        <BankersLamp key={sz} position={[0, 0.765, sz * 0.9]} />
      ))}
      {[-1.2, 0, 1.2].map((z) =>
        [-1, 1].map((sx) => (
          <Chair key={`${z}${sx}`} position={[sx * (width / 2 + 0.35), 0, z]} rotationY={(sx * -Math.PI) / 2} />
        )),
      )}
      {/* Books left open, and a closed one with a ribbon. */}
      <OpenBook position={[-0.25, 0.77, -0.35]} rotationY={0.3} />
      <OpenBook position={[0.22, 0.77, 0.5]} rotationY={Math.PI - 0.2} />
      <mesh position={[0.3, 0.79, -1.3]} rotation={[0, 0.5, 0]}>
        <boxGeometry args={[0.18, 0.04, 0.25]} />
        <meshStandardMaterial color="#5a1e1a" roughness={0.7} />
      </mesh>
    </group>
  )
}

function OpenBook({ position, rotationY }: { position: [number, number, number]; rotationY: number }) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.1, 0.008, 0]} rotation={[0, 0, s * -0.08]}>
          <boxGeometry args={[0.2, 0.016, 0.27]} />
          <meshStandardMaterial color="#f2ead8" roughness={0.9} />
        </mesh>
      ))}
      <mesh position={[0, -0.002, 0]}>
        <boxGeometry args={[0.42, 0.006, 0.29]} />
        <meshStandardMaterial color="#3a2a4a" roughness={0.7} />
      </mesh>
    </group>
  )
}

/** The desk at the far end, where your own saved discoveries are kept in a great ledger. */
function Desk() {
  const [x, z] = LIBRARY.desk
  const saved = useLibrary().length
  useInteractable({
    position: useMemo(() => new Vector3(x, 1, z), [x, z]),
    radius: 2.2,
    prompt: saved
      ? `Press E to read your ${saved} saved ${saved === 1 ? 'discovery' : 'discoveries'}`
      : 'Press E to open your Library',
    onInteract: () => openOverlay('library'),
  })
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.4, 0]} castShadow>
        <boxGeometry args={[1.8, 0.8, 0.7]} />
        <meshStandardMaterial color={OAK} roughness={0.45} />
      </mesh>
      {/* Drawer fronts and brass handles. */}
      {[-0.55, 0.55].map((dx) => (
        <group key={dx}>
          <mesh position={[dx, 0.6, 0.352]}>
            <boxGeometry args={[0.5, 0.18, 0.01]} />
            <meshStandardMaterial color={DARK_OAK} roughness={0.5} />
          </mesh>
          <mesh position={[dx, 0.6, 0.362]}>
            <boxGeometry args={[0.1, 0.015, 0.01]} />
            <meshStandardMaterial {...BRASS} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 0.81, 0]}>
        <boxGeometry args={[1.86, 0.03, 0.76]} />
        <meshStandardMaterial color={DARK_OAK} roughness={0.35} />
      </mesh>
      {/* A slanted book rest holding the ledger, open. */}
      <group position={[0, 0.84, 0.02]} rotation={[0.35, 0, 0]}>
        <mesh position={[0, 0.03, 0]}>
          <boxGeometry args={[0.7, 0.04, 0.42]} />
          <meshStandardMaterial color={OAK} roughness={0.5} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.15, 0.065, 0]} rotation={[0, 0, s * -0.06]}>
            <boxGeometry args={[0.29, 0.025, 0.38]} />
            <meshStandardMaterial color="#f4ecd8" roughness={0.85} emissive="#ffe8b0" emissiveIntensity={0.12} />
          </mesh>
        ))}
        {/* A ribbon down the middle. */}
        <mesh position={[0, 0.08, 0.05]}>
          <boxGeometry args={[0.015, 0.004, 0.4]} />
          <meshStandardMaterial color="#8a1a20" />
        </mesh>
      </group>
      <BankersLamp position={[0.62, 0.825, -0.1]} />
      {/* An inkwell and a quill. */}
      <mesh position={[-0.65, 0.86, 0.1]}>
        <cylinderGeometry args={[0.035, 0.04, 0.06, 12]} />
        <meshStandardMaterial color="#141820" roughness={0.2} />
      </mesh>
      <mesh position={[-0.62, 0.95, 0.08]} rotation={[0.3, 0, -0.35]}>
        <coneGeometry args={[0.015, 0.24, 6]} />
        <meshStandardMaterial color="#efe8dc" roughness={0.8} />
      </mesh>
    </group>
  )
}

/** A long Persian-style runner under the reading table. */
function Rug() {
  const rug = useTiledTexture('rug', 1, 1)
  const { at, length } = LIBRARY.table
  return (
    <mesh position={[at[0], 0.006, at[1]]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[3.2, length + 2.2]} />
      <meshStandardMaterial color="#c8a890" map={rug} roughness={0.95} />
    </mesh>
  )
}

/** Brass pendant lamps hanging down the middle of the room. */
function Pendants() {
  return (
    <>
      {[-3.5, -0.4, 2.7].map((z) => (
        <group key={z} position={[0, H, z]}>
          <mesh position={[0, -0.6, 0]}>
            <cylinderGeometry args={[0.006, 0.006, 1.2, 4]} />
            <meshStandardMaterial color="#2a2a2a" />
          </mesh>
          <mesh position={[0, -1.25, 0]}>
            <coneGeometry args={[0.24, 0.18, 20, 1, true]} />
            <meshStandardMaterial {...BRASS} side={2} />
          </mesh>
          <mesh position={[0, -1.3, 0]}>
            <sphereGeometry args={[0.06, 12, 8]} />
            <meshBasicMaterial color="#fff2d0" toneMapped={false} />
          </mesh>
          <pointLight position={[0, -1.4, 0]} color="#ffdcaa" intensity={4} distance={7} decay={1.5} />
        </group>
      ))}
    </>
  )
}

/** The Library: tall bookcases on three walls, a reading table, a rolling ladder, and your saved discoveries. */
export default function Library() {
  const { sideCases, backCases } = LIBRARY
  return (
    <group>
      <Atmosphere background="#0c0806" />
      <hemisphereLight args={['#ffe8c8', '#3a2414', 0.8]} />
      <ambientLight color="#ffe0b8" intensity={0.15} />
      <RoomShell
        width={W}
        length={L}
        height={H}
        cornerShade={false}
        floor={{ color: '#ffffff', texture: 'herringbone' }}
        walls={{ color: '#3a4a3a', texture: 'damask' }}
        ceiling={{ color: '#e8dcc4', texture: 'plaster' }}
      />
      <CornerShading width={W} length={L} height={H} />
      {[-1, 1].map((side) => (
        <group key={side} position={[side * (W / 2 - 0.02), 0, sideCases.z]} rotation={[0, (-side * Math.PI) / 2, 0]}>
          <Bookcase
            length={sideCases.length}
            height={CASE_HEIGHT}
            shelves={TALL_SHELVES}
            seed={side > 0 ? 11 : 29}
            wood={OAK}
            back={DARK_OAK}
          />
        </group>
      ))}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * backCases.x, 0, -L / 2 + 0.02]}>
          <Bookcase
            length={backCases.length}
            height={CASE_HEIGHT}
            shelves={TALL_SHELVES}
            seed={side > 0 ? 41 : 53}
            wood={OAK}
            back={DARK_OAK}
          />
        </group>
      ))}
      <Painting name="map" position={[0, 2.5, -L / 2 + 0.03]} rotationY={0} width={1.9} />
      <Ladder />
      <Rug />
      <ReadingTable />
      <Desk />
      <Pendants />
    </group>
  )
}
