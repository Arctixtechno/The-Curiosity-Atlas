import { useEffect, useMemo } from 'react'
import { CanvasTexture, SRGBColorSpace, Vector3 } from 'three'
import { EXHIBITS } from '../features/museum/exhibits.ts'
import { exhibitOverlay, type ExhibitId } from '../features/museum/overlayId.ts'
import { MODELS } from '../features/museum/models.tsx'
import { useTiledTexture } from '../hooks/useTiledTexture.ts'
import { useInteractable } from '../world/InteractionSystem.tsx'
import { openOverlay } from '../world/overlay.ts'
import { Atmosphere } from './Atmosphere.tsx'
import { MUSEUM } from './dimensions.ts'
import { RoomShell } from './RoomShell.tsx'

const { width: W, length: L, height: H } = MUSEUM
const GILT = { color: '#d2ae5c', metalness: 0.6, roughness: 0.3 }
const GLASS = { color: '#e4f0f4', transparent: true, opacity: 0.12, roughness: 0.04, metalness: 0.1, depthWrite: false }
const DARK_WOOD = '#3a2416'
/** The skylight down the middle of the ceiling. */
const SKYLIGHT = { width: 4, length: 10 }

function useCanvas(width: number, height: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    draw(canvas.getContext('2d')!, width, height)
    const tex = new CanvasTexture(canvas)
    tex.colorSpace = SRGBColorSpace
    tex.anisotropy = 4
    return tex
  }, [width, height, draw])
  useEffect(() => () => texture.dispose(), [texture])
  return texture
}

/** Gilt lettering over the far wall. */
function drawTitle(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#4a1418'
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = '#e2c27a'
  ctx.font = `${Math.round(h * 0.5)}px Georgia, 'Times New Roman', serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('MUSEUM  OF  EVERYTHING', w / 2, h / 2 + 2)
}

/** A label card: the exhibit's name and date. */
function useLabel(id: ExhibitId) {
  const { name, date } = EXHIBITS[id]
  const draw = useMemo(
    () => (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      ctx.fillStyle = '#f3eee2'
      ctx.fillRect(0, 0, w, h)
      ctx.fillStyle = '#2a2420'
      ctx.textAlign = 'center'
      ctx.font = `bold ${Math.round(h * 0.28)}px Georgia, serif`
      ctx.fillText(name, w / 2, h * 0.45, w - 20)
      ctx.font = `italic ${Math.round(h * 0.2)}px Georgia, serif`
      ctx.fillStyle = '#6a5a4a'
      ctx.fillText(date, w / 2, h * 0.78, w - 20)
    },
    [name, date],
  )
  return useCanvas(512, 128, draw)
}

/** Each exhibit opens its own panel, from anywhere near its case. */
function useExhibit(id: ExhibitId, at: [number, number], height: number) {
  useInteractable({
    position: useMemo(() => new Vector3(at[0], height, at[1]), [at, height]),
    radius: 2,
    prompt: `Press E to look closer at the ${EXHIBITS[id].short}`,
    onInteract: () => openOverlay(exhibitOverlay(id)),
  })
}

/** How each model sits in its case: lifted onto a stand, turned to face the room. */
const POSES: Record<ExhibitId, { y: number; rotation: [number, number, number]; scale?: number }> = {
  astrolabe: { y: 0.15, rotation: [0, 0, 0] },
  chronometer: { y: 0.04, rotation: [-1.1, 0, 0] },
  ammonite: { y: 0.05, rotation: [-1.2, 0, 0] },
  antikythera: { y: 0.1, rotation: [-0.9, 0, 0] },
  meteorite: { y: 0.11, rotation: [0, 0.4, 0] },
  rosetta: { y: 0, rotation: [0, 0, 0] },
}

/** A glazed table case on a mahogany stand, with the exhibit on a velvet base. */
function TableCase({ id, at }: { id: ExhibitId; at: [number, number] }) {
  useExhibit(id, at, 1.1)
  const label = useLabel(id)
  const Model = MODELS[id]
  const pose = POSES[id]
  const top = 0.9
  return (
    <group position={[at[0], 0, at[1]]}>
      <mesh position={[0, top / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.9, top, 0.7]} />
        <meshStandardMaterial color="#6e3a24" roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.04, 0]}>
        <boxGeometry args={[0.96, 0.08, 0.76]} />
        <meshStandardMaterial color={DARK_WOOD} roughness={0.5} />
      </mesh>
      <mesh position={[0, top + 0.01, 0]}>
        <boxGeometry args={[0.84, 0.02, 0.64]} />
        <meshStandardMaterial color="#2a2a3c" roughness={1} />
      </mesh>
      <group position={[0, top + 0.02 + pose.y, 0]} rotation={pose.rotation}>
        <Model />
      </group>
      {/* A small brass stand for upright pieces. */}
      {pose.y > 0.1 && (
        <mesh position={[0, top + 0.06, -0.01]}>
          <cylinderGeometry args={[0.006, 0.02, 0.08, 12]} />
          <meshStandardMaterial {...GILT} />
        </mesh>
      )}
      <mesh position={[0, top + 0.21, 0]}>
        <boxGeometry args={[0.86, 0.4, 0.66]} />
        <meshStandardMaterial {...GLASS} />
      </mesh>
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} position={[sx * 0.43, top + 0.21, sz * 0.33]}>
            <boxGeometry args={[0.015, 0.4, 0.015]} />
            <meshStandardMaterial {...GILT} />
          </mesh>
        )),
      )}
      <mesh position={[0, top - 0.12, 0.351]}>
        <planeGeometry args={[0.44, 0.11]} />
        <meshStandardMaterial map={label} roughness={0.8} />
      </mesh>
    </group>
  )
}

/** A tall glass case on a plinth, for the stone at the end of the gallery. */
function TallCase({ id, at }: { id: ExhibitId; at: [number, number] }) {
  useExhibit(id, at, 1.3)
  const label = useLabel(id)
  const Model = MODELS[id]
  const plinth = 0.45
  return (
    <group position={[at[0], 0, at[1]]}>
      <mesh position={[0, plinth / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.2, plinth, 0.7]} />
        <meshStandardMaterial color="#2a2a2c" roughness={0.6} />
      </mesh>
      <group position={[0, plinth, 0]}>
        <Model />
      </group>
      <mesh position={[0, plinth + 0.75, 0]}>
        <boxGeometry args={[1.18, 1.5, 0.68]} />
        <meshStandardMaterial {...GLASS} />
      </mesh>
      <mesh position={[0, plinth + 1.505, 0]}>
        <boxGeometry args={[1.2, 0.03, 0.7]} />
        <meshStandardMaterial color="#1c1c1e" roughness={0.5} />
      </mesh>
      <mesh position={[0.32, plinth - 0.12, 0.351]}>
        <planeGeometry args={[0.44, 0.11]} />
        <meshStandardMaterial map={label} roughness={0.8} />
      </mesh>
    </group>
  )
}

/** A round stone plinth with the exhibit standing in the open. */
function OpenPlinth({ id, at }: { id: ExhibitId; at: [number, number] }) {
  useExhibit(id, at, 1)
  const label = useLabel(id)
  const marble = useTiledTexture('marble', 2, 1)
  const Model = MODELS[id]
  const height = 0.85
  return (
    <group position={[at[0], 0, at[1]]}>
      <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.36, 0.42, height, 40]} />
        <meshStandardMaterial color="#efeae0" map={marble} roughness={0.35} />
      </mesh>
      <mesh position={[0, height + 0.01, 0]}>
        <cylinderGeometry args={[0.4, 0.4, 0.03, 40]} />
        <meshStandardMaterial color="#efeae0" map={marble} roughness={0.35} />
      </mesh>
      <group position={[0, height + 0.025 + POSES[id].y, 0]} rotation={POSES[id].rotation}>
        <Model />
      </group>
      {/* The label on a little slanted stand in front. */}
      <group position={[0, 0, 0.62]}>
        <mesh position={[0, 0.45, 0]}>
          <cylinderGeometry args={[0.015, 0.02, 0.9, 10]} />
          <meshStandardMaterial {...GILT} />
        </mesh>
        <mesh position={[0, 0.92, 0]} rotation={[-0.7, 0, 0]}>
          <planeGeometry args={[0.44, 0.11]} />
          <meshStandardMaterial map={label} roughness={0.8} />
        </mesh>
      </group>
    </group>
  )
}

/** A buttoned leather gallery seat, for sitting with the Rosetta Stone in view. */
function Ottoman() {
  const leather = useTiledTexture('leather', 4, 1)
  const [x, z] = MUSEUM.bench
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.2, 0]} castShadow>
        <boxGeometry args={[1.8, 0.3, 0.5]} />
        <meshStandardMaterial color={DARK_WOOD} roughness={0.45} />
      </mesh>
      <mesh position={[0, 0.4, 0]} castShadow>
        <boxGeometry args={[1.84, 0.12, 0.54]} />
        <meshStandardMaterial color="#5a2a22" map={leather} roughness={0.5} />
      </mesh>
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} position={[sx * 0.84, 0.03, sz * 0.2]}>
            <cylinderGeometry args={[0.03, 0.025, 0.06, 10]} />
            <meshStandardMaterial {...GILT} />
          </mesh>
        )),
      )}
    </group>
  )
}

/** A coved ceiling with a long laylight of frosted glass: daylight from above, as in the old London galleries. */
function Skylight() {
  const bars: { x: number; z: number; w: number; l: number }[] = []
  for (let x = -SKYLIGHT.width / 2; x <= SKYLIGHT.width / 2 + 0.01; x += 1) bars.push({ x, z: 0, w: 0.07, l: SKYLIGHT.length })
  for (let z = -SKYLIGHT.length / 2; z <= SKYLIGHT.length / 2 + 0.01; z += 1) bars.push({ x: 0, z, w: SKYLIGHT.width, l: 0.07 })
  return (
    <group position={[0, H - 0.01, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[SKYLIGHT.width, SKYLIGHT.length]} />
        <meshBasicMaterial color="#e6ebe8" toneMapped={false} />
      </mesh>
      {bars.map((b, i) => (
        <mesh key={i} position={[b.x, -0.02, b.z]}>
          <boxGeometry args={[b.w, 0.05, b.l]} />
          <meshStandardMaterial color="#e8e4da" roughness={0.6} />
        </mesh>
      ))}
    </group>
  )
}

/** Moulded cornice, picture rail and skirting along every wall. */
function Mouldings() {
  const sides = [
    { position: [0, 0, -L / 2], rotationY: 0, length: W },
    { position: [-W / 2, 0, 0], rotationY: Math.PI / 2, length: L },
    { position: [W / 2, 0, 0], rotationY: -Math.PI / 2, length: L },
    { position: [0, 0, L / 2], rotationY: Math.PI, length: W },
  ] as const
  return (
    <>
      {sides.map((s, i) => (
        <group key={i} position={s.position as unknown as [number, number, number]} rotation={[0, s.rotationY, 0]}>
          <mesh position={[0, 0.12, 0.02]}>
            <boxGeometry args={[s.length, 0.24, 0.04]} />
            <meshStandardMaterial color={DARK_WOOD} roughness={0.5} />
          </mesh>
          <mesh position={[0, 3.2, 0.02]}>
            <boxGeometry args={[s.length, 0.05, 0.04]} />
            <meshStandardMaterial {...GILT} />
          </mesh>
          <mesh position={[0, H - 0.15, 0.08]}>
            <boxGeometry args={[s.length, 0.3, 0.16]} />
            <meshStandardMaterial color="#f2eee4" roughness={0.8} />
          </mesh>
          {/* The wall above the picture rail is painted stone colour. */}
          <mesh position={[0, (3.22 + H - 0.3) / 2, 0.005]}>
            <planeGeometry args={[s.length, H - 0.3 - 3.22]} />
            <meshStandardMaterial color="#e8e0cc" roughness={0.9} />
          </mesh>
        </group>
      ))}
    </>
  )
}

function Title() {
  const texture = useCanvas(1024, 96, drawTitle)
  return (
    <group position={[0, 2.75, -L / 2 + 0.02]}>
      <mesh>
        <planeGeometry args={[4.2, 0.4]} />
        <meshStandardMaterial map={texture} roughness={0.6} metalness={0.1} />
      </mesh>
    </group>
  )
}

/** The Museum of Everything: a top-lit gallery of six exhibits, each one you can turn over in your hands. */
export default function Museum() {
  return (
    <group>
      <Atmosphere background="#0e0a08" />
      <hemisphereLight args={['#f6f4ee', '#c8b6a4', 1.15]} />
      {/* Daylight falling from the skylight. */}
      <directionalLight position={[0.5, 8, 1]} color="#fbfaf4" intensity={1.3} />
      <pointLight position={[0, H - 0.6, -4]} color="#fff6e8" intensity={5} distance={9} decay={1.4} />
      <pointLight position={[0, H - 0.6, 2]} color="#fff6e8" intensity={5} distance={9} decay={1.4} />
      <RoomShell
        cornerShade={false}
        width={W}
        length={L}
        height={H}
        floor={{ color: '#d8c0a0', texture: 'wood' }}
        walls={{ color: '#a33434', texture: 'fabric' }}
        ceiling={{ color: '#ffffff' }}
      />
      <Mouldings />
      <Skylight />
      <Title />
      {(Object.keys(MUSEUM.exhibits) as ExhibitId[]).map((id) => {
        const { at, case: kind } = MUSEUM.exhibits[id]
        if (kind === 'tall') return <TallCase key={id} id={id} at={at} />
        if (kind === 'open') return <OpenPlinth key={id} id={id} at={at} />
        return <TableCase key={id} id={id} at={at} />
      })}
      <Ottoman />
    </group>
  )
}
