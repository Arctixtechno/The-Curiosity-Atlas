import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { Quaternion, Vector3, type Camera, type PerspectiveCamera } from 'three'
import { EYE_HEIGHT, LOUNGE, loungeChair } from '../../rooms/dimensions.ts'
import { requestFrame } from '../../world/FrameScheduler.tsx'
import { closeOverlay } from '../../world/overlay.ts'
import { prefersReducedMotion } from '../../world/settings.ts'
import { gameStore, useGame } from '../../world/store.ts'
import { openPanel } from '../panels.ts'
import { setSeatAnchors } from './seatView.ts'

// Sitting down in the lounge: the camera eases into the visitor's armchair
// and turns to the companion's chair, then the conversation opens over that
// view. Closing the conversation stands you back up in front of the chair.

export const SEAT_VIEW = 'lounge-seat'
/** How long sitting down or standing up takes, in seconds. */
const SIT_SECONDS = 1.3

const visitor = loungeChair(-1)
const companion = loungeChair(1)
/** The eye, sitting back in the visitor's chair. */
const SEATED = new Vector3(
  visitor.x - Math.sin(visitor.rotationY) * 0.08,
  LOUNGE.seatedEye,
  visitor.z - Math.cos(visitor.rotationY) * 0.08,
)
/** Where the companion would sit: their head, above the other chair. */
export const COMPANION_HEAD = new Vector3(companion.x, 1.05, companion.z)
/** The flames in the grate. */
const FIRE = new Vector3(0, 0.45, -LOUNGE.length / 2 + 0.3)
/** Standing up leaves you in front of the chairs, facing the fire. */
const STANDING = new Vector3(visitor.x, EYE_HEIGHT, LOUNGE.seatingZ + 1.05)

/**
 * Seated, you look across at the companion's chair. On a wide screen it sits
 * left of centre, leaving the right-hand side for the conversation, with the
 * fire's glow coming in from the left; on a narrow one it's straight ahead.
 */
function seatedRotation(camera: Camera) {
  const to = new Vector3().subVectors(COMPANION_HEAD, SEATED)
  const facing = Math.atan2(-to.x, -to.z)
  const { fov, aspect } = camera as PerspectiveCamera
  const wide = aspect > 1.2 && window.innerWidth > 760
  // Turn right until the companion is 40% of the way from the centre to the left edge.
  const turn = wide ? Math.atan(0.4 * Math.tan(((fov / 2) * Math.PI) / 180) * aspect) : 0
  return eulerQuat(facing - turn, -0.1)
}

function eulerQuat(yaw: number, pitch: number) {
  const qYaw = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), yaw)
  const qPitch = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), pitch)
  return qYaw.multiply(qPitch)
}

/** Sits the visitor down, from the armchair's E prompt. */
export function sitDown() {
  if (!gameStore.get().viewing) gameStore.set({ viewing: SEAT_VIEW, prompt: null })
}

interface Move {
  from: { position: Vector3; rotation: Quaternion }
  to: { position: Vector3; rotation: Quaternion }
  start: number
  done: () => void
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)

/** Where the companion's chair and the fire show on screen, so the conversation can place things over them. */
function placeAnchors(camera: Camera) {
  const onScreen = (v: Vector3) => {
    const p = v.clone().project(camera)
    return { x: (p.x + 1) / 2, y: (1 - p.y) / 2 }
  }
  setSeatAnchors({ companion: onScreen(COMPANION_HEAD), fire: onScreen(FIRE) })
}

function pose(camera: Camera) {
  return { position: camera.position.clone(), rotation: camera.quaternion.clone() }
}

export function LoungeSeat() {
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const seated = useGame((s) => s.viewing === SEAT_VIEW)
  const overlay = useGame((s) => s.overlay)
  const move = useRef<Move | null>(null)
  // Whether the visitor is seated with the conversation open, so its closing means standing up.
  const talking = useRef(false)

  const animate = (to: Move['to'], done: () => void) => {
    move.current = { from: pose(camera), to, start: -1, done }
    if (prefersReducedMotion) finish()
  }
  const finish = () => {
    const m = move.current
    if (!m) return
    camera.position.copy(m.to.position)
    camera.quaternion.copy(m.to.rotation)
    move.current = null
    m.done()
  }

  // Sit down, then open the conversation.
  useEffect(() => {
    if (!seated || talking.current || move.current) return
    animate({ position: SEATED.clone(), rotation: seatedRotation(camera) }, () => {
      placeAnchors(camera)
      talking.current = true
      // Escape can release the mouse mid-way, which ends viewing; the visitor is in the chair all the same.
      if (gameStore.get().viewing !== SEAT_VIEW) gameStore.set({ viewing: SEAT_VIEW })
      openPanel('lounge')
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seated])

  // The conversation closed: stand up.
  useEffect(() => {
    if (!seated || overlay !== null || !talking.current) return
    animate({ position: STANDING.clone(), rotation: eulerQuat(0, -0.08) }, () => {
      talking.current = false
      gameStore.set({ viewing: null })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overlay, seated])

  // Keep the anchor right if the window changes size while talking.
  useEffect(() => {
    if (!seated || !talking.current) return
    placeAnchors(camera)
  }, [size, seated, camera])

  // Leaving the room (or the page) mid-conversation always lets you stand.
  useEffect(
    () => () => {
      if (gameStore.get().viewing === SEAT_VIEW) gameStore.set({ viewing: null })
      if (gameStore.get().overlay === 'lounge') closeOverlay()
    },
    [],
  )

  useFrame(({ clock }) => {
    const m = move.current
    if (!m) return
    if (m.start < 0) m.start = clock.elapsedTime
    const t = Math.min(1, (clock.elapsedTime - m.start) / SIT_SECONDS)
    const k = ease(t)
    camera.position.lerpVectors(m.from.position, m.to.position, k)
    // Dip a little on the way down into the chair, as a body does.
    camera.position.y -= Math.sin(t * Math.PI) * 0.04
    camera.quaternion.slerpQuaternions(m.from.rotation, m.to.rotation, k)
    if (t >= 1) finish()
    // Keep drawing until the move ends, whatever the frame scheduler would otherwise choose.
    else requestFrame()
  })

  return null
}
