import { useEffect, useMemo } from 'react'
import {
  BufferGeometry,
  CanvasTexture,
  Color,
  ExtrudeGeometry,
  RepeatWrapping,
  Float32BufferAttribute,
  IcosahedronGeometry,
  Shape,
  SRGBColorSpace,
  Vector3,
} from 'three'

// Models of the museum's exhibits, built in code at roughly their real size in
// metres. They're representations, not scans: shapes and proportions follow
// the descriptions on each exhibit's source page.

const BRASS = { color: '#c9a24e', metalness: 0.75, roughness: 0.32 }

function seeded(seed: number) {
  let s = seed >>> 0 || 1
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
}

/** Paints a canvas once into a texture, disposed with the component. */
function useCanvas(size: number, draw: (ctx: CanvasRenderingContext2D, s: number) => void, height = size) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = height
    draw(canvas.getContext('2d')!, size)
    const tex = new CanvasTexture(canvas)
    tex.colorSpace = SRGBColorSpace
    tex.anisotropy = 4
    return tex
  }, [size, height]) // Each call site passes a fixed painter.
  useEffect(() => () => texture.dispose(), [texture])
  return texture
}

function useDisposable<T extends { dispose(): void }>(make: () => T) {
  const value = useMemo(make, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => value.dispose(), [value])
  return value
}

/** Engraved brass: a plate of the astrolabe's front, with its lines of altitude and the tropics. */
function drawAstrolabePlate(ctx: CanvasRenderingContext2D, s: number) {
  const c = s / 2
  ctx.fillStyle = '#b8923f'
  ctx.fillRect(0, 0, s, s)
  ctx.strokeStyle = 'rgba(60, 40, 10, 0.75)'
  ctx.lineWidth = 2
  // Tropic of Capricorn (the plate's edge), the equator and the Tropic of Cancer.
  for (const r of [0.48, 0.36, 0.26]) {
    ctx.beginPath()
    ctx.arc(c, c, s * r, 0, Math.PI * 2)
    ctx.stroke()
  }
  // Almucantars: circles of equal altitude, crowding towards the zenith above the centre.
  ctx.lineWidth = 1.2
  for (let i = 0; i < 16; i++) {
    const t = i / 16
    const r = s * (0.44 - t * 0.4)
    ctx.beginPath()
    ctx.arc(c, c - s * 0.12 * t - s * 0.05, r, 0, Math.PI * 2)
    ctx.stroke()
  }
  // Meridian and horizon lines.
  ctx.beginPath()
  ctx.moveTo(c, c - s * 0.48)
  ctx.lineTo(c, c + s * 0.48)
  ctx.moveTo(c - s * 0.48, c)
  ctx.lineTo(c + s * 0.48, c)
  ctx.stroke()
  // Unequal hour lines below the horizon.
  for (let i = 1; i < 12; i++) {
    const a = (i / 12) * Math.PI
    ctx.beginPath()
    ctx.moveTo(c, c + s * 0.06)
    ctx.quadraticCurveTo(c + Math.cos(a) * s * 0.3, c + s * 0.25, c + Math.cos(a) * s * 0.46, c + Math.sin(a) * s * 0.3)
    ctx.stroke()
  }
}

/** The astrolabe's degree scale round the rim, and on the back the shadow square. */
function drawAstrolabeScale(ctx: CanvasRenderingContext2D, s: number) {
  const c = s / 2
  ctx.fillStyle = '#c29a48'
  ctx.fillRect(0, 0, s, s)
  ctx.strokeStyle = 'rgba(60, 40, 10, 0.8)'
  for (let i = 0; i < 360; i += 2) {
    const a = (i / 180) * Math.PI
    const inner = i % 10 === 0 ? 0.4 : 0.44
    ctx.lineWidth = i % 10 === 0 ? 2 : 1
    ctx.beginPath()
    ctx.moveTo(c + Math.cos(a) * s * inner, c + Math.sin(a) * s * inner)
    ctx.lineTo(c + Math.cos(a) * s * 0.48, c + Math.sin(a) * s * 0.48)
    ctx.stroke()
  }
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(c, c, s * 0.39, 0, Math.PI * 2)
  ctx.stroke()
  ctx.strokeRect(c - s * 0.2, c, s * 0.4, s * 0.2)
  for (let i = 1; i < 12; i++) {
    ctx.beginPath()
    ctx.moveTo(c - s * 0.2 + (i * s * 0.4) / 12, c + s * 0.2)
    ctx.lineTo(c - s * 0.2 + (i * s * 0.4) / 12, c + s * 0.18)
    ctx.stroke()
  }
}

/** A planispheric astrolabe: the mater with its throne and ring, a plate, the openwork rete and the rule. */
export function Astrolabe() {
  const plate = useCanvas(512, drawAstrolabePlate)
  const scale = useCanvas(512, drawAstrolabeScale)
  const R = 0.09
  // Star pointers on the rete, as [angle, distance from centre].
  const pointers = [
    [0.3, 0.7],
    [1.2, 0.55],
    [2.0, 0.78],
    [2.7, 0.62],
    [3.6, 0.72],
    [4.4, 0.5],
    [5.2, 0.8],
    [5.8, 0.6],
  ]
  return (
    <group>
      {/* The mater: a thick disc with a raised rim. */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[R, R, 0.006, 64]} />
        <meshStandardMaterial {...BRASS} />
      </mesh>
      <mesh position={[0, 0, -0.0031]} rotation={[0, Math.PI, 0]}>
        <circleGeometry args={[R * 0.99, 64]} />
        <meshStandardMaterial {...BRASS} color="#ffffff" map={scale} />
      </mesh>
      <mesh position={[0, 0, 0.004]}>
        <torusGeometry args={[R - 0.004, 0.004, 10, 64]} />
        <meshStandardMaterial {...BRASS} />
      </mesh>
      <mesh position={[0, 0, 0.0031]}>
        <circleGeometry args={[R - 0.008, 64]} />
        <meshStandardMaterial {...BRASS} color="#ffffff" map={plate} />
      </mesh>
      {/* The rete: the ecliptic ring set off-centre, a frame of spokes and pointers to the bright stars. */}
      <group position={[0, 0, 0.006]}>
        <mesh position={[0, R * 0.2, 0]}>
          <torusGeometry args={[R * 0.55, 0.0025, 6, 64]} />
          <meshStandardMaterial {...BRASS} />
        </mesh>
        <mesh>
          <torusGeometry args={[R * 0.86, 0.002, 6, 64]} />
          <meshStandardMaterial {...BRASS} />
        </mesh>
        {[0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map((a) => (
          <mesh
            key={a}
            rotation={[0, 0, a]}
            position={[Math.cos(a + Math.PI / 2) * R * 0.43, Math.sin(a + Math.PI / 2) * R * 0.43, 0]}
          >
            <boxGeometry args={[0.003, R * 0.86, 0.0015]} />
            <meshStandardMaterial {...BRASS} />
          </mesh>
        ))}
        {pointers.map(([a, d]) => (
          <mesh key={a} position={[Math.cos(a) * R * d, Math.sin(a) * R * d, 0]} rotation={[0, 0, a + Math.PI / 2]}>
            <coneGeometry args={[0.004, 0.018, 3]} />
            <meshStandardMaterial {...BRASS} />
          </mesh>
        ))}
      </group>
      {/* The rule on the front, and the pin and horse that hold it all together. */}
      <mesh position={[0, 0, 0.009]} rotation={[0, 0, 0.6]}>
        <boxGeometry args={[R * 1.9, 0.008, 0.0015]} />
        <meshStandardMaterial {...BRASS} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.004]}>
        <cylinderGeometry args={[0.003, 0.003, 0.02, 12]} />
        <meshStandardMaterial {...BRASS} />
      </mesh>
      {/* The alidade, the sighting rule, on the back. */}
      <mesh position={[0, 0, -0.0045]} rotation={[0, 0, -0.9]}>
        <boxGeometry args={[R * 1.9, 0.01, 0.002]} />
        <meshStandardMaterial {...BRASS} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[Math.cos(-0.9) * s * R * 0.75, Math.sin(-0.9) * s * R * 0.75, -0.009]} rotation={[0, 0, -0.9]}>
          <boxGeometry args={[0.004, 0.01, 0.01]} />
          <meshStandardMaterial {...BRASS} />
        </mesh>
      ))}
      {/* The throne at the top, and the shackle and ring to hang it from. */}
      <mesh position={[0, R + 0.008, 0]}>
        <cylinderGeometry args={[0.012, 0.02, 0.018, 3]} />
        <meshStandardMaterial {...BRASS} />
      </mesh>
      <mesh position={[0, R + 0.026, 0]} rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[0.007, 0.002, 8, 20]} />
        <meshStandardMaterial {...BRASS} />
      </mesh>
      <mesh position={[0, R + 0.042, 0]}>
        <torusGeometry args={[0.012, 0.0025, 8, 24]} />
        <meshStandardMaterial {...BRASS} />
      </mesh>
    </group>
  )
}

/** The chronometer's enamel dial: Roman hours, a ring of minutes and painted scrollwork. */
function drawWatchDial(ctx: CanvasRenderingContext2D, s: number) {
  const c = s / 2
  ctx.fillStyle = '#f6f1e4'
  ctx.fillRect(0, 0, s, s)
  ctx.strokeStyle = '#2a2420'
  ctx.fillStyle = '#2a2420'
  ctx.lineWidth = 2
  for (const r of [0.47, 0.42]) {
    ctx.beginPath()
    ctx.arc(c, c, s * r, 0, Math.PI * 2)
    ctx.stroke()
  }
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2
    ctx.beginPath()
    ctx.moveTo(c + Math.sin(a) * s * 0.42, c - Math.cos(a) * s * 0.42)
    ctx.lineTo(c + Math.sin(a) * s * 0.47, c - Math.cos(a) * s * 0.47)
    ctx.lineWidth = i % 5 ? 1 : 3
    ctx.stroke()
  }
  const numerals = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI']
  ctx.font = `${Math.round(s * 0.07)}px Georgia, serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  numerals.forEach((n, i) => {
    const a = (i / 12) * Math.PI * 2
    ctx.save()
    ctx.translate(c + Math.sin(a) * s * 0.35, c - Math.cos(a) * s * 0.35)
    ctx.rotate(a)
    ctx.fillText(n, 0, 0)
    ctx.restore()
  })
  // Painted scrolls of leaves round the centre.
  ctx.strokeStyle = 'rgba(42, 36, 32, 0.6)'
  ctx.lineWidth = 1.5
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4
    ctx.beginPath()
    for (let t = 0; t < 1; t += 0.02) {
      const r = s * (0.06 + t * 0.18)
      const b = a + t * 2.4
      const x = c + Math.cos(b) * r
      const y = c + Math.sin(b) * r
      if (t === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
  }
  // Seconds dial at six o'clock.
  ctx.beginPath()
  ctx.arc(c, c + s * 0.18, s * 0.07, 0, Math.PI * 2)
  ctx.stroke()
}

/** A marine chronometer in the form of a large pocket watch, in a silver case with a bow to hold it by. */
export function Chronometer() {
  const dial = useCanvas(512, drawWatchDial)
  // H4's silver cases are some 13 cm across.
  const R = 0.065
  const silver = { color: '#d6d8da', metalness: 0.9, roughness: 0.22 }
  return (
    <group>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[R, R, 0.03, 64]} />
        <meshStandardMaterial {...silver} />
      </mesh>
      {/* The domed back. */}
      <mesh position={[0, 0, -0.015]} rotation={[-Math.PI / 2, 0, 0]} scale={[1, 0.25, 1]}>
        <sphereGeometry args={[R, 48, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial {...silver} />
      </mesh>
      <mesh position={[0, 0, 0.0152]}>
        <circleGeometry args={[R * 0.92, 64]} />
        <meshStandardMaterial map={dial} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0, 0.016]}>
        <torusGeometry args={[R * 0.95, 0.0035, 10, 64]} />
        <meshStandardMaterial {...silver} />
      </mesh>
      {/* Hands, set at about ten past ten, and the seconds hand. */}
      <mesh position={[Math.sin(-1.0) * -0.012, 0.012, 0.0165]} rotation={[0, 0, 1.0]}>
        <boxGeometry args={[0.003, 0.03, 0.0008]} />
        <meshStandardMaterial color="#1c1a18" />
      </mesh>
      <mesh position={[0.019, 0.011, 0.017]} rotation={[0, 0, -1.05]}>
        <boxGeometry args={[0.0022, 0.045, 0.0008]} />
        <meshStandardMaterial color="#1c1a18" />
      </mesh>
      <mesh position={[0, -0.012 + 0.003, 0.0172]} rotation={[0, 0, 0.4]}>
        <boxGeometry args={[0.0008, 0.008, 0.0006]} />
        <meshStandardMaterial color="#1c1a18" />
      </mesh>
      {/* Pendant and bow. */}
      <mesh position={[0, R + 0.006, 0]}>
        <cylinderGeometry args={[0.005, 0.006, 0.014, 16]} />
        <meshStandardMaterial {...silver} />
      </mesh>
      <mesh position={[0, R + 0.016, 0]}>
        <sphereGeometry args={[0.006, 16, 12]} />
        <meshStandardMaterial {...silver} />
      </mesh>
      <mesh position={[0, R + 0.018, 0]} rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[0.016, 0.0025, 8, 32, Math.PI]} />
        <meshStandardMaterial {...silver} />
      </mesh>
    </group>
  )
}

/** A planispiral shell: a tube winding out along a logarithmic spiral, with ribs across it. */
function ammoniteGeometry() {
  const turns = 3.6
  const steps = 420
  const around = 28
  const b = Math.log(2.2) / (Math.PI * 2) // Each whorl is about 2.2 times the size of the one inside it.
  const a = 0.004
  const positions: number[] = []
  const colours: number[] = []
  const index: number[] = []
  const base = new Color('#a88e6a')
  const rib = new Color('#d8c6a2')
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * turns * Math.PI * 2
    const r = a * Math.exp(b * t)
    const tube = r * 0.42
    // Ribs: the tube swells slightly and lightens where each rib crosses.
    const ribs = Math.pow(Math.max(0, Math.sin(t * 7)), 6)
    const centre = new Vector3(Math.cos(t) * r, 0, Math.sin(t) * r)
    const outward = new Vector3(Math.cos(t), 0, Math.sin(t))
    for (let j = 0; j <= around; j++) {
      const p = (j / around) * Math.PI * 2
      // A slightly flattened cross-section, like most ammonites.
      const swell = tube * (1 + ribs * 0.06)
      const point = centre
        .clone()
        .addScaledVector(outward, Math.cos(p) * swell)
        .add(new Vector3(0, Math.sin(p) * swell * 0.8, 0))
      positions.push(point.x, point.y, point.z)
      const c = base.clone().lerp(rib, ribs * 0.6 + 0.15 * Math.sin(t * 0.7) ** 2)
      colours.push(c.r, c.g, c.b)
    }
  }
  for (let i = 0; i < steps; i++) {
    for (let j = 0; j < around; j++) {
      const k = i * (around + 1) + j
      index.push(k, k + around + 1, k + 1, k + 1, k + around + 1, k + around + 2)
    }
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(positions, 3))
  g.setAttribute('color', new Float32BufferAttribute(colours, 3))
  g.setIndex(index)
  g.computeVertexNormals()
  return g
}

/** A fossil ammonite, its chambered shell coiled flat. */
export function Ammonite() {
  const geometry = useDisposable(ammoniteGeometry)
  return (
    <group rotation={[Math.PI / 2, 0, 0]}>
      <mesh geometry={geometry} castShadow>
        <meshStandardMaterial vertexColors roughness={0.75} side={2} />
      </mesh>
    </group>
  )
}

/** Etched iron: interlocking bands of kamacite crossing at three angles, as an octahedrite shows when cut and etched. */
function drawWidmanstatten(ctx: CanvasRenderingContext2D, s: number) {
  const rand = seeded(17)
  ctx.fillStyle = '#a4a8ac'
  ctx.fillRect(0, 0, s, s)
  for (const angle of [0, Math.PI / 3, (2 * Math.PI) / 3]) {
    ctx.save()
    ctx.translate(s / 2, s / 2)
    ctx.rotate(angle)
    for (let i = 0; i < 320; i++) {
      const x = (rand() - 0.5) * s * 1.4
      const y = (rand() - 0.5) * s * 1.4
      const len = s * (0.05 + rand() * 0.2)
      const w = 1.5 + rand() * 4
      ctx.fillStyle = rand() > 0.5 ? 'rgba(210, 214, 218, 0.4)' : 'rgba(110, 114, 120, 0.35)'
      ctx.fillRect(x - len / 2, y - w / 2, len, w)
      ctx.fillStyle = 'rgba(60, 62, 66, 0.4)'
      ctx.fillRect(x - len / 2, y - w / 2, len, 1)
    }
    ctx.restore()
  }
}

/** A rounded lump of iron, rusted brown, with one face cut flat, polished and etched. */
function meteoriteGeometry() {
  const g = new IcosahedronGeometry(0.16, 6)
  const pos = g.attributes.position
  const v = new Vector3()
  const colours: number[] = []
  const uvs: number[] = []
  const rust = new Color('#7a5a42')
  const cut = new Color('#ffffff')
  const face = 0.09
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    const n = v.clone().normalize()
    // Low, rounded bumps, with shallow thumbprint hollows from its fall.
    const bump =
      1 +
      0.12 * Math.sin(n.x * 4.1 + 1.3) * Math.cos(n.y * 3.7) +
      0.07 * Math.sin(n.z * 6.3 + n.x * 2) -
      0.05 * Math.abs(Math.sin(n.x * 11) * Math.sin(n.y * 9 + n.z * 7))
    v.copy(n).multiplyScalar(0.16 * bump)
    v.y *= 0.7
    const flat = v.z > face
    if (flat) v.z = face
    pos.setXYZ(i, v.x, v.y, v.z)
    const c = flat ? cut : rust
    colours.push(c.r, c.g, c.b)
    uvs.push(v.x / 0.36 + 0.5, v.y / 0.36 + 0.5)
  }
  g.setAttribute('color', new Float32BufferAttribute(colours, 3))
  g.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  g.computeVertexNormals()
  // Turn the cut face off to one side, so the rusted crust shows too.
  g.rotateY(Math.PI / 4)
  return g
}

/** An iron meteorite with a cut, etched face showing its crystal pattern. */
export function Meteorite() {
  const geometry = useDisposable(meteoriteGeometry)
  const etched = useCanvas(512, drawWidmanstatten)
  return (
    <mesh geometry={geometry} castShadow>
      <meshStandardMaterial vertexColors map={etched} metalness={0.35} roughness={0.5} />
    </mesh>
  )
}

/** The corroded bronze of the largest fragment (fragment A, about 180 × 150 mm), as a jagged slab. */
function fragmentShape() {
  const rand = seeded(5)
  const shape = new Shape()
  const n = 40
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    const r = 0.085 * (0.8 + rand() * 0.25) * (1 + 0.15 * Math.sin(a * 3))
    const x = Math.cos(a) * r * 1.05
    const y = Math.sin(a) * r * 0.9
    if (i === 0) shape.moveTo(x, y)
    else shape.lineTo(x, y)
  }
  shape.closePath()
  return shape
}

/** A gear wheel with `teeth` teeth and four spokes, as a flat ring. */
function gearShape(radius: number, teeth: number) {
  const shape = new Shape()
  const depth = radius * 0.025
  for (let i = 0; i <= teeth * 2; i++) {
    const a = (i / (teeth * 2)) * Math.PI * 2
    const r = i % 2 ? radius : radius - depth
    const x = Math.cos(a) * r
    const y = Math.sin(a) * r
    if (i === 0) shape.moveTo(x, y)
    else shape.lineTo(x, y)
  }
  // Four openings between the spokes.
  for (let q = 0; q < 4; q++) {
    const hole = new Shape()
    const a0 = (q / 4) * Math.PI * 2 + 0.12
    const a1 = ((q + 1) / 4) * Math.PI * 2 - 0.12
    const inner = radius * 0.2
    const outer = radius * 0.82
    hole.absarc(0, 0, outer, a0, a1, false)
    hole.absarc(0, 0, inner, a1, a0, true)
    shape.holes.push(hole)
  }
  return shape
}

/** Corroded bronze: green and brown patches, pitted, with paler encrustation. */
function drawCorrosion(ctx: CanvasRenderingContext2D, s: number) {
  const rand = seeded(23)
  ctx.fillStyle = '#7d8c68'
  ctx.fillRect(0, 0, s, s)
  for (let i = 0; i < 260; i++) {
    const x = rand() * s
    const y = rand() * s
    const r = 4 + rand() * 30
    const colour = ['rgba(120, 150, 110, 0.35)', 'rgba(80, 60, 40, 0.35)', 'rgba(170, 170, 140, 0.3)', 'rgba(40, 50, 36, 0.4)'][
      Math.floor(rand() * 4)
    ]
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, colour)
    g.addColorStop(1, 'rgba(0, 0, 0, 0)')
    ctx.fillStyle = g
    ctx.fillRect(x - r, y - r, r * 2, r * 2)
  }
  for (let i = 0; i < 1500; i++) {
    ctx.fillStyle = `rgba(20, 24, 16, ${0.2 + rand() * 0.3})`
    ctx.fillRect(rand() * s, rand() * s, 1.5, 1.5)
  }
}

/** The largest surviving fragment of the Antikythera mechanism, with its great four-spoked wheel: about 13 cm across, with 223 teeth. */
export function Antikythera({ teeth = 223 }: { teeth?: number }) {
  const slab = useDisposable(
    () =>
      new ExtrudeGeometry(fragmentShape(), {
        depth: 0.022,
        bevelEnabled: true,
        bevelSize: 0.003,
        bevelThickness: 0.003,
        bevelSegments: 2,
      }),
  )
  const gear = useDisposable(
    () => new ExtrudeGeometry(gearShape(0.065, teeth), { depth: 0.002, bevelEnabled: false, curveSegments: 4 }),
  )
  const small = useDisposable(
    () => new ExtrudeGeometry(gearShape(0.018, 38), { depth: 0.002, bevelEnabled: false, curveSegments: 4 }),
  )
  const crust = useCanvas(256, drawCorrosion)
  // The extruded shapes' UVs are in metres, so repeat the texture every 10 cm.
  useMemo(() => {
    crust.wrapS = crust.wrapT = RepeatWrapping
    crust.repeat.set(10, 10)
  }, [crust])
  // Lumps of encrustation still covering parts of the wheel.
  const lumps = useMemo(() => {
    const rand = seeded(41)
    return Array.from({ length: 7 }, () => {
      const a = 2.4 + rand() * 1.8
      const r = 0.055 + rand() * 0.025
      return [Math.cos(a) * r, Math.sin(a) * r, 0.005 + rand() * 0.008] as const
    })
  }, [])
  const material = { map: crust, metalness: 0.25, roughness: 0.9 }
  return (
    <group>
      <mesh geometry={slab} position={[0, 0, -0.011]} castShadow>
        <meshStandardMaterial {...material} color="#b4b4a4" flatShading />
      </mesh>
      <mesh geometry={gear} position={[0.005, -0.004, 0.0135]}>
        <meshStandardMaterial {...material} color="#e8ecd8" metalness={0.45} roughness={0.7} />
      </mesh>
      <mesh geometry={small} position={[-0.05, 0.045, 0.0155]}>
        <meshStandardMaterial {...material} color="#d8dcc8" />
      </mesh>
      {lumps.map(([x, y, size], i) => (
        <mesh key={i} position={[x, y, 0.014]} scale={[1, 0.8, 0.35]}>
          <icosahedronGeometry args={[size, 1]} />
          <meshStandardMaterial {...material} color="#b8b8a0" flatShading />
        </mesh>
      ))}
    </group>
  )
}

/** The inscribed face: hieroglyphs at the top, Demotic in the middle, Greek below, as stylised marks rather than the real text. */
function drawInscription(ctx: CanvasRenderingContext2D, w: number) {
  const h = ctx.canvas.height
  const rand = seeded(11)
  ctx.fillStyle = '#3a3a3c'
  ctx.fillRect(0, 0, w, h)
  // Speckled granodiorite.
  for (let i = 0; i < 9000; i++) {
    ctx.fillStyle = rand() > 0.6 ? 'rgba(200, 196, 190, 0.35)' : 'rgba(10, 10, 12, 0.35)'
    ctx.fillRect(rand() * w, rand() * h, 1.5, 1.5)
  }
  ctx.fillStyle = 'rgba(205, 200, 192, 0.55)'
  const band = (top: number, bottom: number, lines: number, mark: (x: number, y: number, size: number) => void) => {
    const lh = (bottom - top) / lines
    for (let l = 0; l < lines; l++) {
      for (let x = 30; x < w - 30; x += lh * (0.6 + rand() * 0.5)) mark(x, top + l * lh + lh / 2, lh * 0.55)
    }
  }
  // Hieroglyphs: small figures and shapes. The top of this band is broken away.
  band(h * 0.06, h * 0.28, 7, (x, y, s) => {
    const k = Math.floor(rand() * 4)
    if (k === 0) ctx.fillRect(x, y - s / 2, s * 0.25, s)
    else if (k === 1) {
      ctx.beginPath()
      ctx.arc(x + s / 3, y, s / 3, 0, Math.PI * 2)
      ctx.fill()
    } else if (k === 2) {
      ctx.beginPath()
      ctx.moveTo(x, y + s / 2)
      ctx.lineTo(x + s / 3, y - s / 2)
      ctx.lineTo(x + (2 * s) / 3, y + s / 2)
      ctx.fill()
    } else ctx.fillRect(x, y - s / 6, s * 0.7, s / 3)
  })
  // Demotic: a flowing cursive.
  ctx.strokeStyle = 'rgba(205, 200, 192, 0.55)'
  ctx.lineWidth = 2
  band(h * 0.31, h * 0.6, 16, (x, y, s) => {
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.bezierCurveTo(x + s * 0.3, y - s * rand(), x + s * 0.5, y + s * rand(), x + s * 0.7, y)
    ctx.stroke()
  })
  // Greek: rows of small capitals.
  ctx.font = '13px Georgia, serif'
  const letters = 'ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ'
  band(h * 0.63, h * 0.97, 26, (x, y) => {
    ctx.fillText(letters[Math.floor(rand() * letters.length)], x, y + 4)
  })
}

/** A dark granodiorite stele, its top corners broken off, inscribed on its face in three scripts. */
export function RosettaStone({ size = [1.123, 0.757, 0.284] }: { size?: [number, number, number] }) {
  const [height, width, depth] = size
  const face = useCanvas(512, drawInscription, Math.round((512 * height) / width))
  const shape = useMemo(() => {
    // The outline, with the upper left and right broken away.
    const s = new Shape()
    const w = width / 2
    s.moveTo(-w, 0)
    s.lineTo(w, 0)
    s.lineTo(w, height * 0.72)
    s.lineTo(w * 0.7, height * 0.86)
    s.lineTo(w * 0.35, height * 0.9)
    s.lineTo(w * 0.1, height)
    s.lineTo(-w * 0.45, height * 0.95)
    s.lineTo(-w * 0.8, height * 0.78)
    s.lineTo(-w, height * 0.62)
    s.closePath()
    return s
  }, [width, height])
  const body = useMemo(
    () => new ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: 0.01, bevelThickness: 0.01 }),
    [shape, depth],
  )
  useEffect(() => () => body.dispose(), [body])
  const front = useMemo(() => {
    const g = new ExtrudeGeometry(shape, { depth: 0.001, bevelEnabled: false })
    // Map the face texture across the outline.
    const pos = g.attributes.position
    const uv = g.attributes.uv
    for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / width + 0.5, pos.getY(i) / height)
    return g
  }, [shape, width, height])
  useEffect(() => () => front.dispose(), [front])
  return (
    <group position={[0, 0, -depth / 2]}>
      <mesh geometry={body} castShadow>
        <meshStandardMaterial color="#2e2e30" roughness={0.6} />
      </mesh>
      <mesh geometry={front} position={[0, 0, depth + 0.0105]}>
        <meshStandardMaterial map={face} roughness={0.45} />
      </mesh>
    </group>
  )
}

export const MODELS = {
  astrolabe: Astrolabe,
  chronometer: Chronometer,
  ammonite: Ammonite,
  meteorite: Meteorite,
  antikythera: Antikythera,
  rosetta: RosettaStone,
} as const
