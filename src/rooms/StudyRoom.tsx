import { RoundedBox } from '@react-three/drei'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { CanvasTexture, Color, Object3D, SRGBColorSpace, Vector3, type InstancedMesh } from 'three'
import { WallClock } from '../components/Furnishings.tsx'
import { Glow } from '../components/Glow.tsx'
import { Mouldings } from '../components/Mouldings.tsx'
import { Painting } from '../components/Painting.tsx'
import { timer } from '../features/study/focus.ts'
import { studyOverlay, type StudyTab } from '../features/study/overlayId.ts'
import { formatClock, PHASE_NAMES, timeLeft } from '../features/study/timer.ts'
import { useLathe } from '../hooks/useLathe.ts'
import { useSurfaceTexture, useTiledTexture } from '../hooks/useTiledTexture.ts'
import { requestFrame } from '../world/FrameScheduler.tsx'
import { useInteractable } from '../world/InteractionSystem.tsx'
import { openOverlay } from '../world/overlay.ts'
import { Atmosphere } from './Atmosphere.tsx'
import { STUDY } from './dimensions.ts'
import { RoomShell } from './RoomShell.tsx'

// The study room: a warm, lived-in room for a study group. A long oak table
// with green banker's lamps, a whiteboard from the last session, shelves of
// books, a window seat in the late afternoon sun and a sofa by the door.
// The things on the table and walls open the study tools.

const { width: W, length: L, height: H } = STUDY
const OAK = '#7a5232'
const DARK_OAK = '#4a3020'
const BRASS = { color: '#c9a25a', metalness: 0.8, roughness: 0.3 }
const LAMP_GREEN = '#1f5a3a'
const BOOK_COLOURS = ['#6b2a22', '#2f4a3a', '#1f3350', '#7a5a2a', '#4a2a44', '#8a7a5a', '#2a2a2a', '#a84a2a', '#33402a', '#3a5a7a']

/** A texture painted once on a canvas, released with the room. */
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

/** Something in the room that opens one of the study tools. */
function useTool(tab: StudyTab, position: [number, number, number], radius: number, prompt: string) {
  useInteractable({
    position: useMemo(() => new Vector3(...position), [position]),
    radius,
    prompt,
    onInteract: () => openOverlay(studyOverlay(tab)),
  })
}

const hand = "'Segoe Print', 'Bradley Hand', 'Comic Sans MS', cursive"

/** The whiteboard, left from the last session: a plan, a forgetting curve, and a reminder. */
function drawWhiteboard(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#f7f8f6'
  ctx.fillRect(0, 0, w, h)
  // Faint ghosts of earlier writing, never quite wiped off.
  ctx.fillStyle = 'rgba(120, 130, 150, 0.06)'
  for (let i = 0; i < 9; i++) ctx.fillRect(40 + i * 110, 60 + ((i * 53) % 300), 160, 18)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = '#1f3a7a'
  ctx.font = `bold 46px ${hand}`
  ctx.fillText('Study group: this week', 50, 80)
  ctx.font = `30px ${hand}`
  const plan = ['1. Recall first, then check', '2. Teach it back to the group', '3. Mix up the topics', '4. 25 min on, 5 min off']
  plan.forEach((line, i) => ctx.fillText(line, 60, 150 + i * 52))
  ctx.fillStyle = '#a82a2a'
  ctx.font = `bold 32px ${hand}`
  ctx.fillText('Mock exam Friday!', 70, 390)
  ctx.strokeStyle = '#a82a2a'
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.ellipse(205, 378, 170, 34, -0.03, 0, Math.PI * 2)
  ctx.stroke()

  // A forgetting curve, lifted each time it's reviewed.
  const gx = 600
  const gy = 380
  const gw = 400
  const gh = 250
  ctx.strokeStyle = '#2a2a2a'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(gx, gy - gh)
  ctx.lineTo(gx, gy)
  ctx.lineTo(gx + gw, gy)
  ctx.stroke()
  ctx.fillStyle = '#2a2a2a'
  ctx.font = `24px ${hand}`
  ctx.fillText('memory', gx - 10, gy - gh - 12)
  ctx.fillText('time', gx + gw - 50, gy + 32)
  ctx.strokeStyle = '#1f7a4a'
  ctx.lineWidth = 4
  ctx.beginPath()
  const reviews = [0, 70, 160, 290]
  reviews.forEach((start, i) => {
    const end = reviews[i + 1] ?? gw
    const decay = 40 + i * 50
    for (let x = start; x <= end; x += 4) {
      const y = gy - gh * (0.25 + 0.75 * Math.exp(-(x - start) / decay))
      if (x === start) ctx.lineTo(gx + x, gy - gh)
      else ctx.lineTo(gx + x, y)
    }
  })
  ctx.stroke()
  ctx.fillStyle = '#1f7a4a'
  ctx.font = `22px ${hand}`
  ctx.fillText('review!', gx + 50, gy - gh - 10)
  ctx.fillText('review!', gx + 150, gy - gh + 24)

  // A tiny distillation column in the corner, from someone's revision.
  ctx.strokeStyle = '#1f3a7a'
  ctx.lineWidth = 3
  ctx.strokeRect(1080, 90, 60, 260)
  for (let y = 130; y < 340; y += 36) {
    ctx.beginPath()
    ctx.moveTo(1084, y)
    ctx.lineTo(1136, y)
    ctx.stroke()
  }
  ctx.fillStyle = '#1f3a7a'
  ctx.font = `20px ${hand}`
  ctx.fillText('gas', 1150, 110)
  ctx.fillText('naphtha', 1150, 170)
  ctx.fillText('kerosene', 1150, 230)
  ctx.fillText('diesel', 1150, 290)
  ctx.fillText('residue', 1150, 345)
  ctx.fillText('crude in', 990, 330)
}

function Whiteboard() {
  const { width, height, bottom } = STUDY.whiteboard
  const texture = useCanvas(1300, 560, drawWhiteboard)
  const z = -L / 2 + 0.02
  useTool('notes', [0, 1.5, z + 0.3], 2.6, 'Press E to take notes at the whiteboard')
  return (
    <group position={[0, bottom + height / 2, z]}>
      <mesh position={[0, 0, 0.015]}>
        <boxGeometry args={[width + 0.06, height + 0.06, 0.03]} />
        <meshStandardMaterial color="#b8bcc0" metalness={0.6} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0, 0.032]}>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial map={texture} roughness={0.25} />
      </mesh>
      {/* The pen tray, with three markers and a duster. */}
      <mesh position={[0, -height / 2 - 0.03, 0.06]}>
        <boxGeometry args={[width * 0.7, 0.025, 0.07]} />
        <meshStandardMaterial color="#a8acb0" metalness={0.6} roughness={0.35} />
      </mesh>
      {['#1f3a7a', '#a82a2a', '#1f7a4a'].map((c, i) => (
        <mesh key={c} position={[-0.6 + i * 0.16, -height / 2 - 0.005, 0.07]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.01, 0.01, 0.13, 8]} />
          <meshStandardMaterial color={c} roughness={0.5} />
        </mesh>
      ))}
      <mesh position={[0.5, -height / 2 + 0.005, 0.07]}>
        <boxGeometry args={[0.14, 0.04, 0.05]} />
        <meshStandardMaterial color="#2a2a3a" roughness={0.8} />
      </mesh>
    </group>
  )
}

/** Cork with index cards and sticky notes pinned to it: the to-do list. */
function drawCorkboard(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#b8875a'
  ctx.fillRect(0, 0, w, h)
  let seed = 11
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  for (let i = 0; i < 4000; i++) {
    ctx.fillStyle = rand() > 0.5 ? 'rgba(90, 55, 25, 0.25)' : 'rgba(230, 190, 140, 0.25)'
    ctx.fillRect(rand() * w, rand() * h, 2 + rand() * 3, 2 + rand() * 3)
  }
  const notes: { x: number; y: number; w: number; h: number; colour: string; lines: string[]; turn: number }[] = [
    { x: 40, y: 40, w: 250, h: 170, colour: '#fbf6e6', lines: ['TO DO', '☐ Read ch. 5', '☐ Past paper Q3', '☑ Flashcards'], turn: -0.04 },
    { x: 330, y: 60, w: 170, h: 170, colour: '#f6e27a', lines: ['Exam', '12 Nov', '9:30'], turn: 0.05 },
    { x: 530, y: 40, w: 170, h: 170, colour: '#f2a6b4', lines: ['Group', 'Thurs 4pm'], turn: -0.03 },
    { x: 90, y: 250, w: 230, h: 150, colour: '#a8d8e8', lines: ['Ask about', 'question 7b'], turn: 0.03 },
    { x: 380, y: 270, w: 300, h: 150, colour: '#fbf6e6', lines: ['Library books', 'due back Mon'], turn: -0.02 },
  ]
  for (const n of notes) {
    ctx.save()
    ctx.translate(n.x + n.w / 2, n.y + n.h / 2)
    ctx.rotate(n.turn)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)'
    ctx.fillRect(-n.w / 2 + 5, -n.h / 2 + 7, n.w, n.h)
    ctx.fillStyle = n.colour
    ctx.fillRect(-n.w / 2, -n.h / 2, n.w, n.h)
    ctx.fillStyle = '#2a2a3a'
    n.lines.forEach((line, i) => {
      ctx.font = `${i === 0 ? 'bold ' : ''}28px ${hand}`
      ctx.fillText(line, -n.w / 2 + 16, -n.h / 2 + 42 + i * 38, n.w - 24)
    })
    ctx.fillStyle = '#c83a2a'
    ctx.beginPath()
    ctx.arc(0, -n.h / 2 + 10, 9, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
}

function Corkboard() {
  const { z, width, height } = STUDY.corkboard
  const texture = useCanvas(740, 460, drawCorkboard)
  const x = W / 2 - 0.02
  useTool('todo', [x - 0.3, 1.5, z], 2.4, 'Press E to look at your to-do list')
  return (
    <group position={[x, 1.55, z]} rotation={[0, -Math.PI / 2, 0]}>
      <mesh position={[0, 0, 0.015]}>
        <boxGeometry args={[width + 0.08, height + 0.08, 0.03]} />
        <meshStandardMaterial color={OAK} roughness={0.6} />
      </mesh>
      <mesh position={[0, 0, 0.031]}>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial map={texture} roughness={0.9} />
      </mesh>
    </group>
  )
}

/** The focus timer on the table: a little wooden clock whose face shows the real timer. */
function DeskTimer({ position }: { position: [number, number, number] }) {
  useTool('timer', [position[0], 0.9, position[2]], 2.4, 'Press E to use the focus timer')
  const { canvas, texture } = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 128
    const texture = new CanvasTexture(canvas)
    texture.colorSpace = SRGBColorSpace
    return { canvas, texture }
  }, [])
  useEffect(() => {
    const ctx = canvas.getContext('2d')!
    let last = ''
    const draw = () => {
      const t = timer.get()
      const time = formatClock(timeLeft(t, Date.now()))
      const caption = t.running ? PHASE_NAMES[t.phase] : 'Press E'
      if (time + caption === last) return
      last = time + caption
      ctx.fillStyle = '#16120e'
      ctx.fillRect(0, 0, 256, 128)
      ctx.fillStyle = t.phase === 'focus' ? '#f0a850' : t.phase === 'short' ? '#8fd4a8' : '#9cc4ec'
      ctx.textAlign = 'center'
      ctx.font = 'bold 64px ui-monospace, Menlo, Consolas, monospace'
      ctx.fillText(time, 128, 76)
      ctx.font = '22px Georgia, serif'
      ctx.globalAlpha = 0.75
      ctx.fillText(caption, 128, 112)
      ctx.globalAlpha = 1
      texture.needsUpdate = true
      requestFrame()
    }
    draw()
    // Redrawn once a second at most, and only when the numbers change.
    const id = setInterval(draw, 1000)
    const unsubscribe = timer.subscribe(draw)
    return () => {
      clearInterval(id)
      unsubscribe()
    }
  }, [canvas, texture])
  useEffect(() => () => texture.dispose(), [texture])
  return (
    <group position={position} rotation={[0, 0.4, 0]}>
      <RoundedBox args={[0.24, 0.13, 0.1]} radius={0.015} smoothness={3} position={[0, 0.065, 0]} castShadow>
        <meshStandardMaterial color={OAK} roughness={0.5} />
      </RoundedBox>
      <mesh position={[0, 0.068, 0.051]}>
        <planeGeometry args={[0.2, 0.1]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.14, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 0.02, 12]} />
        <meshStandardMaterial {...BRASS} />
      </mesh>
    </group>
  )
}

/** A wooden index-card box with cards standing in it: the flashcards. */
function CardBox({ position }: { position: [number, number, number] }) {
  useTool('cards', [position[0], 0.9, position[2]], 2.4, 'Press E to study your flashcards')
  return (
    <group position={position} rotation={[0, 0.3, 0]}>
      <mesh position={[0, 0.05, 0]} castShadow>
        <boxGeometry args={[0.18, 0.1, 0.26]} />
        <meshStandardMaterial color="#8a5a34" roughness={0.5} />
      </mesh>
      {Array.from({ length: 9 }, (_, i) => (
        <mesh key={i} position={[0, 0.1 + (i % 3) * 0.004, -0.1 + i * 0.024]} rotation={[-0.15 + (i % 2) * 0.08, 0, 0]}>
          <boxGeometry args={[0.15, 0.1, 0.002]} />
          <meshStandardMaterial color={i === 3 ? '#f6e27a' : i === 6 ? '#a8d8e8' : '#f8f2e2'} roughness={0.9} />
        </mesh>
      ))}
      {/* Two cards left out on the table. */}
      <mesh position={[0.2, 0.002, 0.12]} rotation={[-Math.PI / 2, 0, 0.4]}>
        <planeGeometry args={[0.15, 0.1]} />
        <meshStandardMaterial color="#f8f2e2" roughness={0.9} />
      </mesh>
      <mesh position={[0.24, 0.003, 0.02]} rotation={[-Math.PI / 2, 0, -0.2]}>
        <planeGeometry args={[0.15, 0.1]} />
        <meshStandardMaterial color="#f6e27a" roughness={0.9} />
      </mesh>
    </group>
  )
}

/** A green-shaded banker's lamp. Its light is painted as a pool on the table rather than lit. */
function BankersLamp({ position, rotationY = 0 }: { position: [number, number, number]; rotationY?: number }) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh position={[0, 0.012, 0]}>
        <cylinderGeometry args={[0.07, 0.08, 0.024, 24]} />
        <meshStandardMaterial {...BRASS} />
      </mesh>
      <mesh position={[0, 0.17, 0]}>
        <cylinderGeometry args={[0.008, 0.008, 0.3, 8]} />
        <meshStandardMaterial {...BRASS} />
      </mesh>
      <group position={[0, 0.32, 0.06]}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.07, 0.07, 0.3, 24, 1, true, 0, Math.PI]} />
          <meshStandardMaterial color={LAMP_GREEN} roughness={0.15} metalness={0.2} side={2} />
        </mesh>
        <mesh position={[0, -0.02, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.02, 0.02, 0.22, 12]} />
          <meshStandardMaterial color="#fff2cc" emissive="#ffd88a" emissiveIntensity={2.2} />
        </mesh>
      </group>
      <Glow position={[0, 0.003, 0.12]} rotation={[-Math.PI / 2, 0, 0]} size={[0.9, 0.7]} color="#ffcf85" opacity={0.45} />
    </group>
  )
}

/** A plain oak chair with a slatted back. Its front faces +z. */
function Chair({ position, rotationY, pulled = 0 }: { position: [number, number, number]; rotationY: number; pulled?: number }) {
  const wood = useTiledTexture('wood', 0.5, 0.5)
  const mat = <meshStandardMaterial color={OAK} map={wood} roughness={0.55} />
  return (
    <group position={position} rotation={[0, rotationY + pulled, 0]}>
      <RoundedBox args={[0.44, 0.05, 0.42]} radius={0.015} smoothness={2} position={[0, 0.46, 0]} castShadow receiveShadow>
        {mat}
      </RoundedBox>
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} position={[sx * 0.19, sz < 0 ? 0.45 : 0.22, sz * 0.18]} castShadow>
            <boxGeometry args={[0.035, sz < 0 ? 0.9 : 0.44, 0.035]} />
            {mat}
          </mesh>
        )),
      )}
      <mesh position={[0, 0.86, -0.18]}>
        <boxGeometry args={[0.42, 0.07, 0.025]} />
        {mat}
      </mesh>
      {[-0.1, 0, 0.1].map((x) => (
        <mesh key={x} position={[x, 0.68, -0.18]}>
          <boxGeometry args={[0.03, 0.3, 0.02]} />
          {mat}
        </mesh>
      ))}
      {/* A green seat pad. */}
      <RoundedBox args={[0.38, 0.03, 0.36]} radius={0.012} smoothness={2} position={[0, 0.5, 0.01]}>
        <meshStandardMaterial color="#3e5a46" roughness={0.95} />
      </RoundedBox>
    </group>
  )
}

/** Things a study group leaves on a table: books, notebooks, a laptop, mugs and pens. */
function TableClutter() {
  const top = STUDY.tableSize.height
  return (
    <group position={[STUDY.table[0], top, STUDY.table[1]]}>
      {/* An open textbook. */}
      <group position={[-0.55, 0.012, 0.32]} rotation={[0, 0.15, 0]}>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.115, 0, 0]} rotation={[0, 0, s * -0.06]}>
            <boxGeometry args={[0.23, 0.02, 0.3]} />
            <meshStandardMaterial color="#f4efe2" roughness={0.9} />
          </mesh>
        ))}
        <mesh position={[0, -0.008, 0]}>
          <boxGeometry args={[0.48, 0.006, 0.31]} />
          <meshStandardMaterial color="#1f3350" roughness={0.7} />
        </mesh>
      </group>
      {/* A laptop, open. */}
      <group position={[0.55, 0, -0.32]} rotation={[0, Math.PI + 0.2, 0]}>
        <mesh position={[0, 0.008, 0]}>
          <boxGeometry args={[0.32, 0.016, 0.22]} />
          <meshStandardMaterial color="#b8bcc4" metalness={0.7} roughness={0.35} />
        </mesh>
        <group position={[0, 0.016, -0.11]} rotation={[-0.3, 0, 0]}>
          <mesh position={[0, 0.105, 0]}>
            <boxGeometry args={[0.32, 0.21, 0.008]} />
            <meshStandardMaterial color="#b8bcc4" metalness={0.7} roughness={0.35} />
          </mesh>
          <mesh position={[0, 0.105, 0.0045]}>
            <planeGeometry args={[0.29, 0.18]} />
            <meshStandardMaterial color="#2a3a4a" emissive="#4a6a8a" emissiveIntensity={0.6} />
          </mesh>
        </group>
      </group>
      {/* Notebooks and a stack of books. */}
      <mesh position={[0.1, 0.006, 0.38]} rotation={[0, -0.3, 0]}>
        <boxGeometry args={[0.21, 0.012, 0.29]} />
        <meshStandardMaterial color="#a84a2a" roughness={0.8} />
      </mesh>
      <mesh position={[-0.2, 0.006, -0.35]} rotation={[0, 0.5, 0]}>
        <boxGeometry args={[0.21, 0.012, 0.29]} />
        <meshStandardMaterial color="#2f4a3a" roughness={0.8} />
      </mesh>
      {[
        [0.24, 0.05, '#6b2a22', 0.1],
        [0.22, 0.04, '#33402a', -0.15],
        [0.2, 0.05, '#7a5a2a', 0.05],
      ].map(([w, h, c, turn], i) => (
        <mesh key={i} position={[-1.05, 0.025 + i * 0.047, -0.3]} rotation={[0, turn as number, 0]}>
          <boxGeometry args={[w as number, h as number, 0.3]} />
          <meshStandardMaterial color={c as string} roughness={0.8} />
        </mesh>
      ))}
      {/* Mugs. */}
      {[
        [0.95, 0.35, '#e8e2d6'],
        [-0.15, -0.42, '#2f5a7a'],
        [-0.95, 0.4, '#c8643a'],
      ].map(([x, z, c]) => (
        <group key={`${x}`} position={[x as number, 0, z as number]}>
          <mesh position={[0, 0.045, 0]}>
            <cylinderGeometry args={[0.04, 0.037, 0.09, 20]} />
            <meshStandardMaterial color={c as string} roughness={0.35} />
          </mesh>
          <mesh position={[0, 0.086, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.035, 20]} />
            <meshStandardMaterial color="#4a2c18" roughness={0.2} />
          </mesh>
          <mesh position={[0.045, 0.048, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.022, 0.006, 8, 16]} />
            <meshStandardMaterial color={c as string} roughness={0.35} />
          </mesh>
        </group>
      ))}
      {/* A pot of pens and pencils. */}
      <group position={[0.3, 0, 0.05]}>
        <mesh position={[0, 0.05, 0]}>
          <cylinderGeometry args={[0.04, 0.04, 0.1, 16, 1, true]} />
          <meshStandardMaterial color="#3a3a3a" roughness={0.4} metalness={0.3} side={2} />
        </mesh>
        {['#e8c040', '#1f3a7a', '#a82a2a', '#e8c040', '#2a2a2a'].map((c, i) => (
          <mesh key={i} position={[Math.sin(i * 1.3) * 0.02, 0.1, Math.cos(i * 1.3) * 0.02]} rotation={[Math.sin(i) * 0.2, 0, Math.cos(i) * 0.2]}>
            <cylinderGeometry args={[0.004, 0.004, 0.16, 6]} />
            <meshStandardMaterial color={c} roughness={0.5} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

/** The long table: an oak top on turned legs, with chairs pulled up and the lamps, timer and cards on it. */
function StudyTable() {
  const { length, depth, height } = STUDY.tableSize
  const [tx, tz] = STUDY.table
  const top = useSurfaceTexture('wood', length, depth, 9, 300)
  const leg = useLathe(
    [
      [0.001, 0],
      [0.035, 0],
      [0.03, 0.05],
      [0.04, 0.12],
      [0.028, 0.3],
      [0.036, 0.55],
      [0.04, 0.62],
      [0.04, height - 0.04],
      [0.001, height - 0.04],
    ],
    14,
  )
  return (
    <group>
      <group position={[tx, 0, tz]}>
        <mesh position={[0, height - 0.02, 0]} castShadow receiveShadow>
          <boxGeometry args={[length, 0.045, depth]} />
          <meshStandardMaterial color="#ffffff" map={top} roughness={0.45} />
        </mesh>
        <mesh position={[0, height - 0.09, 0]}>
          <boxGeometry args={[length - 0.2, 0.1, depth - 0.2]} />
          <meshStandardMaterial color={DARK_OAK} roughness={0.6} />
        </mesh>
        {[-1, 1].flatMap((sx) =>
          [-1, 1].map((sz) => (
            <mesh key={`${sx}${sz}`} geometry={leg} position={[sx * (length / 2 - 0.15), 0, sz * (depth / 2 - 0.15)]} castShadow>
              <meshStandardMaterial color={DARK_OAK} roughness={0.5} />
            </mesh>
          )),
        )}
      </group>
      {STUDY.chairXs.flatMap((x, i) =>
        [-1, 1].map((side) => (
          <Chair
            key={`${x}${side}`}
            position={[tx + x, 0, tz + side * (depth / 2 + 0.28 + ((i + side) % 2) * 0.1)]}
            rotationY={side > 0 ? Math.PI : 0}
            pulled={((i * 2 + side) % 3) * 0.08 - 0.08}
          />
        )),
      )}
      <BankersLamp position={[tx - 0.7, height, tz - 0.05]} rotationY={0} />
      <BankersLamp position={[tx + 0.8, height, tz + 0.05]} rotationY={Math.PI} />
      <TableClutter />
      <DeskTimer position={[tx + 1.45, height, tz + 0.25]} />
      <CardBox position={[tx - 1.45, height, tz + 0.2]} />
    </group>
  )
}

/** A pendant lamp over the table: a cord, a green enamel shade and a warm bulb. */
function Pendant({ x }: { x: number }) {
  const drop = 1.05
  return (
    <group position={[STUDY.table[0] + x, H, STUDY.table[1]]}>
      <mesh position={[0, -drop / 2, 0]}>
        <cylinderGeometry args={[0.006, 0.006, drop, 6]} />
        <meshStandardMaterial color="#2a2a2a" />
      </mesh>
      <mesh position={[0, -drop - 0.08, 0]}>
        <cylinderGeometry args={[0.04, 0.24, 0.18, 32, 1, true]} />
        <meshStandardMaterial color={LAMP_GREEN} roughness={0.25} metalness={0.3} side={2} />
      </mesh>
      <mesh position={[0, -drop - 0.13, 0]}>
        <sphereGeometry args={[0.055, 16, 12]} />
        <meshStandardMaterial color="#fff2cc" emissive="#ffd08a" emissiveIntensity={2.5} />
      </mesh>
      <pointLight position={[0, -drop - 0.25, 0]} color="#ffcf8a" intensity={4} distance={6.5} decay={1.5} />
    </group>
  )
}

const SHELVES = [0.1, 0.5, 0.9, 1.3, 1.7]

/** Built-in shelves of books along the west wall. Every book is one instance of one mesh. */
function Bookshelves() {
  const wood = useTiledTexture('wood', 1, 2)
  const books = useRef<InstancedMesh>(null)
  const length = STUDY.bookcase.length
  const layout = useMemo(() => {
    let seed = 5
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647
    const out: { x: number; y: number; w: number; h: number; d: number; colour: string }[] = []
    for (const y of SHELVES) {
      let x = -length / 2 + 0.06
      while (x < length / 2 - 0.1) {
        if (rand() < 0.07) {
          x += 0.1 + rand() * 0.2
          continue
        }
        const w = 0.025 + rand() * 0.04
        out.push({ x: x + w / 2, y: y + 0.02, w, h: 0.22 + rand() * 0.12, d: 0.18 + rand() * 0.05, colour: BOOK_COLOURS[Math.floor(rand() * BOOK_COLOURS.length)] })
        x += w + 0.003
      }
    }
    return out
  }, [length])
  useLayoutEffect(() => {
    const mesh = books.current!
    const o = new Object3D()
    const colour = new Color()
    layout.forEach((b, i) => {
      o.position.set(b.x, b.y + b.h / 2, 0.04 + b.d / 2)
      o.scale.set(b.w, b.h, b.d)
      o.updateMatrix()
      mesh.setMatrixAt(i, o.matrix)
      mesh.setColorAt(i, colour.set(b.colour).offsetHSL(0, 0, (Math.sin(i * 12.9) - 0.5) * 0.05))
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [layout])
  const height = 2.15
  return (
    <group position={[-W / 2 + 0.02, 0, STUDY.bookcase.z]} rotation={[0, Math.PI / 2, 0]}>
      <mesh position={[0, height / 2, 0.01]}>
        <boxGeometry args={[length, height, 0.02]} />
        <meshStandardMaterial color={DARK_OAK} map={wood} roughness={0.7} />
      </mesh>
      {[-1, 0, 1].map((s) => (
        <mesh key={s} position={[(s * length) / 2, height / 2, 0.17]} castShadow>
          <boxGeometry args={[0.04, height, 0.34]} />
          <meshStandardMaterial color={OAK} map={wood} roughness={0.6} />
        </mesh>
      ))}
      {[...SHELVES, height - 0.02].map((y) => (
        <mesh key={y} position={[0, y, 0.17]} receiveShadow>
          <boxGeometry args={[length, 0.03, 0.34]} />
          <meshStandardMaterial color={OAK} map={wood} roughness={0.6} />
        </mesh>
      ))}
      <instancedMesh ref={books} args={[undefined, undefined, layout.length]} castShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.8} />
      </instancedMesh>
      {/* A globe and a trailing plant on top. */}
      <group position={[length / 2 - 0.4, height, 0.17]}>
        <mesh position={[0, 0.04, 0]}>
          <cylinderGeometry args={[0.05, 0.07, 0.08, 16]} />
          <meshStandardMaterial {...BRASS} />
        </mesh>
        <mesh position={[0, 0.2, 0]}>
          <sphereGeometry args={[0.13, 24, 16]} />
          <meshStandardMaterial color="#6a8aa0" roughness={0.5} />
        </mesh>
      </group>
      <TrailingPlant position={[-length / 2 + 0.5, height, 0.17]} />
    </group>
  )
}

function TrailingPlant({ position }: { position: [number, number, number] }) {
  const leaves = useTiledTexture('hedge', 1, 1)
  return (
    <group position={position}>
      <mesh position={[0, 0.08, 0]}>
        <cylinderGeometry args={[0.1, 0.08, 0.16, 16]} />
        <meshStandardMaterial color="#c86a4a" roughness={0.8} />
      </mesh>
      {[
        [0, 0.2, 0, 0.14],
        [0.1, 0.05, 0.12, 0.09],
        [-0.08, -0.12, 0.16, 0.08],
        [0.02, -0.3, 0.2, 0.07],
      ].map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]}>
          <icosahedronGeometry args={[r, 1]} />
          <meshStandardMaterial color="#8ab878" map={leaves} roughness={0.9} flatShading />
        </mesh>
      ))}
    </group>
  )
}

/** Late afternoon over London rooftops, seen from the window. */
function drawView(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const sky = ctx.createLinearGradient(0, 0, 0, h)
  sky.addColorStop(0, '#6a8ac0')
  sky.addColorStop(0.5, '#e8b888')
  sky.addColorStop(0.8, '#f4c890')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = 'rgba(255, 240, 210, 0.7)'
  ctx.beginPath()
  ctx.arc(w * 0.7, h * 0.6, 30, 0, Math.PI * 2)
  ctx.fill()
  let seed = 3
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  // Two rows of rooftops with chimney pots, the nearer one darker.
  for (const [base, colour] of [
    [0.72, '#8a6a6a'],
    [0.82, '#5a4040'],
  ] as const) {
    ctx.fillStyle = colour
    let x = 0
    while (x < w) {
      const bw = 40 + rand() * 70
      const top = h * base - rand() * 40
      ctx.fillRect(x, top, bw, h)
      if (rand() > 0.4) ctx.fillRect(x + bw * 0.3, top - 18, 10, 18)
      if (rand() > 0.6) {
        ctx.beginPath()
        ctx.moveTo(x, top)
        ctx.lineTo(x + bw / 2, top - 22)
        ctx.lineTo(x + bw, top)
        ctx.fill()
      }
      x += bw
    }
  }
  // A plane tree in the street below.
  ctx.fillStyle = '#3a5a30'
  for (let i = 0; i < 30; i++) {
    ctx.beginPath()
    ctx.arc(w * 0.22 + (rand() - 0.5) * 140, h * 0.86 + (rand() - 0.5) * 90, 22 + rand() * 20, 0, Math.PI * 2)
    ctx.fill()
  }
}

/** A sash window on the east wall, with a cushioned window seat under it. */
function WindowSeat() {
  const { z, width, sill, height } = STUDY.window
  const view = useCanvas(512, 400, drawView)
  const fabric = useTiledTexture('fabric', 2, 1)
  const x = W / 2 - 0.02
  return (
    <group position={[x, 0, z]} rotation={[0, -Math.PI / 2, 0]}>
      <mesh position={[0, sill + height / 2, 0.005]}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial map={view} toneMapped={false} />
      </mesh>
      {/* Frame and glazing bars. */}
      {[
        [0, sill + height, width + 0.12, 0.08],
        [0, sill, width + 0.12, 0.08],
        [0, sill + height / 2, width, 0.05],
      ].map(([px, py, w, h], i) => (
        <mesh key={i} position={[px, py, 0.03]}>
          <boxGeometry args={[w, h, 0.06]} />
          <meshStandardMaterial color="#f2ede4" roughness={0.6} />
        </mesh>
      ))}
      {[-1, -1 / 3, 1 / 3, 1].map((t) => (
        <mesh key={t} position={[(t * width) / 2, sill + height / 2, 0.03]}>
          <boxGeometry args={[t === -1 || t === 1 ? 0.08 : 0.03, height, 0.06]} />
          <meshStandardMaterial color="#f2ede4" roughness={0.6} />
        </mesh>
      ))}
      <Glow position={[0, sill + height / 2, 0.07]} size={[width * 1.6, height * 1.5]} color="#ffd8a8" opacity={0.25} />
      {/* The seat: a panelled box with a long cushion and two scatter cushions. */}
      <mesh position={[0, 0.22, 0.28]} castShadow receiveShadow>
        <boxGeometry args={[width + 0.3, 0.44, 0.56]} />
        <meshStandardMaterial color="#e8e0d0" roughness={0.6} />
      </mesh>
      <RoundedBox args={[width + 0.2, 0.1, 0.5]} radius={0.04} smoothness={3} position={[0, 0.49, 0.28]}>
        <meshStandardMaterial color="#5a7a8a" map={fabric} roughness={0.95} />
      </RoundedBox>
      {[
        [-0.8, '#c8643a', 0.2],
        [-0.45, '#e8d8a8', -0.15],
        [0.85, '#3e5a46', 0.1],
      ].map(([px, c, turn]) => (
        <RoundedBox
          key={px as number}
          args={[0.38, 0.36, 0.12]}
          radius={0.05}
          smoothness={3}
          position={[px as number, 0.7, 0.12]}
          rotation={[-0.25, turn as number, 0]}
        >
          <meshStandardMaterial color={c as string} map={fabric} roughness={0.95} />
        </RoundedBox>
      ))}
      {/* A book left open on the seat. */}
      <mesh position={[0.3, 0.55, 0.32]} rotation={[0, 0.4, 0]}>
        <boxGeometry args={[0.32, 0.025, 0.22]} />
        <meshStandardMaterial color="#f4efe2" roughness={0.9} />
      </mesh>
    </group>
  )
}

/** A deep two-seat sofa against the west wall, a coffee table and a reading lamp: somewhere to read or talk things through. */
function ReadingCorner() {
  const fabric = useTiledTexture('fabric', 2, 2)
  const wood = useTiledTexture('wood', 1, 1)
  const [sx, sz] = STUDY.sofa
  const [cx, cz] = STUDY.coffeeTable
  const sofa = <meshStandardMaterial color="#8a3a2a" map={fabric} roughness={0.95} />
  return (
    <group>
      <group position={[sx, 0, sz]} rotation={[0, Math.PI / 2, 0]}>
        <RoundedBox args={[2, 0.42, 0.9]} radius={0.05} smoothness={3} position={[0, 0.27, 0]} castShadow>
          {sofa}
        </RoundedBox>
        <RoundedBox args={[2, 0.5, 0.2]} radius={0.08} smoothness={3} position={[0, 0.7, -0.36]} castShadow>
          {sofa}
        </RoundedBox>
        {[-1, 1].map((s) => (
          <RoundedBox key={s} args={[0.2, 0.55, 0.9]} radius={0.08} smoothness={3} position={[s * 0.95, 0.45, 0]} castShadow>
            {sofa}
          </RoundedBox>
        ))}
        {[-0.42, 0.42].map((x) => (
          <RoundedBox key={x} args={[0.82, 0.14, 0.68]} radius={0.06} smoothness={3} position={[x, 0.54, 0.08]}>
            {sofa}
          </RoundedBox>
        ))}
        <RoundedBox args={[0.42, 0.4, 0.13]} radius={0.06} smoothness={3} position={[-0.55, 0.78, -0.18]} rotation={[-0.2, 0.15, 0]}>
          <meshStandardMaterial color="#e8d8a8" map={fabric} roughness={0.95} />
        </RoundedBox>
        {/* A knitted throw over one arm. */}
        <mesh position={[0.86, 0.66, 0.1]} rotation={[0, 0, -0.2]}>
          <boxGeometry args={[0.36, 0.06, 0.8]} />
          <meshStandardMaterial color="#c8b48a" map={fabric} roughness={1} />
        </mesh>
      </group>
      <group position={[cx, 0, cz]}>
        <mesh position={[0, 0.4, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.55, 0.04, 0.95]} />
          <meshStandardMaterial color={OAK} map={wood} roughness={0.45} />
        </mesh>
        {[-1, 1].flatMap((a) =>
          [-1, 1].map((b) => (
            <mesh key={`${a}${b}`} position={[a * 0.23, 0.19, b * 0.42]}>
              <boxGeometry args={[0.04, 0.38, 0.04]} />
              <meshStandardMaterial color={DARK_OAK} roughness={0.5} />
            </mesh>
          )),
        )}
        <mesh position={[0, 0.44, -0.2]} rotation={[0, 0.3, 0]}>
          <boxGeometry args={[0.24, 0.04, 0.3]} />
          <meshStandardMaterial color="#4a2a44" roughness={0.8} />
        </mesh>
        <group position={[0.05, 0.42, 0.25]}>
          <mesh position={[0, 0.045, 0]}>
            <cylinderGeometry args={[0.04, 0.037, 0.09, 20]} />
            <meshStandardMaterial color="#e8e2d6" roughness={0.35} />
          </mesh>
        </group>
      </group>
      <FloorLamp x={-W / 2 + 0.45} z={L / 2 - 0.45} />
    </group>
  )
}

function FloorLamp({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.015, 0]}>
        <cylinderGeometry args={[0.16, 0.18, 0.03, 24]} />
        <meshStandardMaterial {...BRASS} />
      </mesh>
      <mesh position={[0, 0.75, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 1.5, 8]} />
        <meshStandardMaterial {...BRASS} />
      </mesh>
      <mesh position={[0, 1.55, 0]}>
        <cylinderGeometry args={[0.16, 0.24, 0.28, 24, 1, true]} />
        <meshStandardMaterial color="#f2e2c0" emissive="#ffc878" emissiveIntensity={0.7} side={2} roughness={0.9} />
      </mesh>
      <pointLight position={[0, 1.45, 0]} color="#ffcf8a" intensity={2.2} distance={5.5} />
    </group>
  )
}

/** A low cabinet by the door with a kettle, mugs and a tin of biscuits, for the breaks. */
function TeaStation() {
  const wood = useTiledTexture('wood', 1, 1)
  const [x, z] = STUDY.teaCabinet
  return (
    <group position={[x, 0, z]} rotation={[0, Math.PI, 0]}>
      <mesh position={[0, 0.45, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.4, 0.9, 0.55]} />
        <meshStandardMaterial color="#3e5a46" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.915, 0]}>
        <boxGeometry args={[1.46, 0.03, 0.6]} />
        <meshStandardMaterial color={OAK} map={wood} roughness={0.45} />
      </mesh>
      {[-0.35, 0.35].map((dx) => (
        <mesh key={dx} position={[dx, 0.5, 0.28]}>
          <boxGeometry args={[0.6, 0.7, 0.01]} />
          <meshStandardMaterial color="#46634e" roughness={0.55} />
        </mesh>
      ))}
      {[-0.08, 0.08].map((dx) => (
        <mesh key={dx} position={[dx, 0.62, 0.29]}>
          <sphereGeometry args={[0.018, 10, 8]} />
          <meshStandardMaterial {...BRASS} />
        </mesh>
      ))}
      {/* Kettle. */}
      <group position={[-0.4, 0.93, 0]}>
        <mesh position={[0, 0.11, 0]}>
          <cylinderGeometry args={[0.08, 0.1, 0.22, 24]} />
          <meshStandardMaterial color="#d8dce0" metalness={0.8} roughness={0.2} />
        </mesh>
        <mesh position={[0, 0.25, -0.02]} rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[0.06, 0.012, 8, 16, Math.PI]} />
          <meshStandardMaterial color="#2a2a2a" roughness={0.5} />
        </mesh>
      </group>
      {/* Mugs on a tray, and a biscuit tin. */}
      <mesh position={[0.1, 0.94, 0]}>
        <boxGeometry args={[0.4, 0.015, 0.3]} />
        <meshStandardMaterial color={DARK_OAK} roughness={0.5} />
      </mesh>
      {[
        [0, -0.06, '#e8e2d6'],
        [0.15, 0.05, '#2f5a7a'],
        [0.2, -0.08, '#e8c040'],
      ].map(([dx, dz, c]) => (
        <mesh key={dx as number} position={[(dx as number) + 0.02, 0.993, dz as number]}>
          <cylinderGeometry args={[0.04, 0.037, 0.09, 18]} />
          <meshStandardMaterial color={c as string} roughness={0.35} />
        </mesh>
      ))}
      <mesh position={[0.5, 0.98, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 0.1, 24]} />
        <meshStandardMaterial color="#a82a2a" metalness={0.5} roughness={0.35} />
      </mesh>
    </group>
  )
}

/** A tall potted plant for the corners. */
function Plant({ x, z }: { x: number; z: number }) {
  const leaves = useTiledTexture('hedge', 1.5, 1.5)
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.22, 0]} castShadow>
        <cylinderGeometry args={[0.24, 0.19, 0.44, 20]} />
        <meshStandardMaterial color="#e8e0d0" roughness={0.5} />
      </mesh>
      {[
        [0, 0.9, 0, 0.36],
        [0.16, 1.25, 0.06, 0.3],
        [-0.14, 1.2, -0.05, 0.3],
        [0.02, 1.55, 0.02, 0.24],
      ].map(([px, py, pz, r], i) => (
        <mesh key={i} position={[px, py, pz]} castShadow>
          <icosahedronGeometry args={[r, 1]} />
          <meshStandardMaterial color="#a8c890" map={leaves} roughness={0.9} flatShading />
        </mesh>
      ))}
    </group>
  )
}

export default function StudyRoom() {
  const rug = useSurfaceTexture('rug', 4.6, 3.6, 7, 260)
  return (
    <group>
      <Atmosphere background="#120d08" />
      <hemisphereLight args={['#ffe9c7', '#4a3624', 1.15]} />
      {/* Late sun through the window. */}
      <directionalLight position={[W / 2 + 3, 3.5, STUDY.window.z + 1]} color="#ffd8a8" intensity={0.9} />
      <RoomShell
        width={W}
        length={L}
        height={H}
        floor={{ color: '#b08860', texture: 'wood' }}
        walls={{ color: '#efe2c8', texture: 'plaster' }}
        ceiling={{ color: '#f4ece0', texture: 'plaster' }}
      />
      <Mouldings
        width={W}
        length={L}
        height={H}
        trim="#f2ede4"
        cornice="#f4ece0"
        dado={{ height: 0.9, colour: '#6a8470' }}
        openings={[{ side: 'south', centre: 0, width: 1.4 }]}
      />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[STUDY.table[0], 0.006, STUDY.table[1]]} receiveShadow>
        <planeGeometry args={[4.6, 3.6]} />
        <meshStandardMaterial map={rug} roughness={1} />
      </mesh>
      <StudyTable />
      <Pendant x={-0.85} />
      <Pendant x={0.85} />
      <Whiteboard />
      <WallClock position={[0, 2.75, -L / 2 + 0.04]} radius={0.2} />
      <Bookshelves />
      <WindowSeat />
      <Corkboard />
      <ReadingCorner />
      <TeaStation />
      <Painting name="botanical" position={[-W / 2 + 0.01, 1.75, 3]} rotationY={Math.PI / 2} width={0.8} />
      <Painting name="map" position={[2.4, 1.85, L / 2 - 0.01]} rotationY={Math.PI} width={0.9} />
      {STUDY.plants.map(([x, z]) => (
        <Plant key={`${x}${z}`} x={x} z={z} />
      ))}
    </group>
  )
}
