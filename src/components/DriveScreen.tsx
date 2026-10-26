import { useEffect, useMemo, useState } from 'react'
import type { Journey } from '../types/room.ts'
import { DRIVE_MS, skipJourney } from '../world/travel.ts'
import './DriveScreen.css'

// The drive to somewhere far away, shown while the room there loads: a car
// on the road at dusk, with the scenery changing from London's rooftops to
// the marshes and, at the end, the refinery's columns and flares.

/** Width of the scenery strip, in pixels. It scrolls past once over the whole drive. */
const STRIP = 3600
const HEIGHT = 260

const FACTS = [
  'A barrel of oil is 42 US gallons: about 159 litres.',
  'The world refines over 80 million barrels of crude oil a day.',
  'Crude oil is mostly carbon (83–87% by weight) and hydrogen (10–14%), with some sulphur, nitrogen and oxygen.',
  'A refinery runs day and night, often for four to six years between shutdowns for inspection, called turnarounds.',
  'A crude distillation column can stand 50 metres tall: taller than a fifteen-storey building.',
  "The flare is a safety valve. It burns gas the plant needs to get rid of quickly, so it never escapes unburnt.",
]

/** Deterministic randomness, so the skyline is the same every drive. */
function seeded(seed: number) {
  let s = seed
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}

/** The far scenery: city, then marshes and pylons, then the refinery, as one long silhouette. */
function Scenery() {
  const shapes = useMemo(() => {
    const rand = seeded(7)
    const city: string[] = []
    // Terraces and towers.
    for (let x = 0; x < 1200; ) {
      const w = 30 + rand() * 70
      const tall = rand() > 0.82
      const h = tall ? 110 + rand() * 90 : 30 + rand() * 50
      city.push(`M${x} ${HEIGHT} V${HEIGHT - h} H${x + w} V${HEIGHT} Z`)
      x += w + rand() * 6
    }
    // A pointed glass tower and a dome, for London.
    city.push(`M520 ${HEIGHT} L560 ${HEIGHT - 235} L600 ${HEIGHT} Z`)
    city.push(`M820 ${HEIGHT} V${HEIGHT - 60} Q860 ${HEIGHT - 120} 900 ${HEIGHT - 60} V${HEIGHT} Z`)
    const marsh: string[] = []
    for (let x = 1350; x < 2300; x += 230) {
      // Lattice pylons.
      marsh.push(`M${x} ${HEIGHT} L${x + 14} ${HEIGHT - 120} L${x + 28} ${HEIGHT} Z M${x - 8} ${HEIGHT - 100} H${x + 36} V${HEIGHT - 96} H${x - 8} Z`)
    }
    for (let x = 1250; x < 2400; x += 40 + rand() * 90) {
      const r = 8 + rand() * 12
      marsh.push(`M${x - r} ${HEIGHT} Q${x} ${HEIGHT - r * 3} ${x + r} ${HEIGHT} Z`)
    }
    const plant: string[] = []
    // Tanks, columns, chimneys and pipe racks.
    for (let x = 2450; x < STRIP; ) {
      const kind = rand()
      if (kind < 0.35) {
        const w = 60 + rand() * 40
        plant.push(`M${x} ${HEIGHT} V${HEIGHT - 34} Q${x + w / 2} ${HEIGHT - 42} ${x + w} ${HEIGHT - 34} V${HEIGHT} Z`)
        x += w + 10
      } else if (kind < 0.7) {
        const w = 14 + rand() * 14
        const h = 110 + rand() * 90
        plant.push(`M${x} ${HEIGHT} V${HEIGHT - h + w / 2} Q${x + w / 2} ${HEIGHT - h - w / 2} ${x + w} ${HEIGHT - h + w / 2} V${HEIGHT} Z`)
        x += w + 18
      } else {
        const w = 70 + rand() * 60
        plant.push(`M${x} ${HEIGHT} V${HEIGHT - 50} H${x + w} V${HEIGHT} Z M${x + w * 0.3} ${HEIGHT - 50} V${HEIGHT - 140} H${x + w * 0.3 + 8} V${HEIGHT - 50} Z`)
        x += w + 12
      }
    }
    return { city: city.join(' '), marsh: marsh.join(' '), plant: plant.join(' ') }
  }, [])
  const flares = [2620, 3080, 3420]
  return (
    <svg className="drive-scenery" width={STRIP} height={HEIGHT} viewBox={`0 0 ${STRIP} ${HEIGHT}`} aria-hidden="true">
      <path d={shapes.city} className="drive-city" />
      {/* Lit windows in the city. */}
      {Array.from({ length: 90 }, (_, i) => {
        const rand = seeded(i + 3)
        return <rect key={i} x={rand() * 1180} y={HEIGHT - 20 - rand() * 60} width={3} height={4} className="drive-window" />
      })}
      <path d={`M1150 ${HEIGHT - 6} H2500`} className="drive-river" />
      <path d={shapes.marsh} className="drive-marsh" />
      <path d={shapes.plant} className="drive-plant" />
      {flares.map((x, i) => (
        <g key={x}>
          <rect x={x} y={HEIGHT - 210 + i * 20} width={6} height={210 - i * 20} className="drive-plant" />
          <ellipse cx={x + 3} cy={HEIGHT - 222 + i * 20} rx={7} ry={14} className="drive-flare" style={{ animationDelay: `${i * 0.3}s` }} />
        </g>
      ))}
      {Array.from({ length: 40 }, (_, i) => {
        const rand = seeded(i + 50)
        return <circle key={i} cx={2460 + rand() * 1120} cy={HEIGHT - 20 - rand() * 150} r={1.6} className="drive-lamp" />
      })}
    </svg>
  )
}

/** A side view of the car: a dark green estate, headlights on. */
function Car() {
  return (
    <svg className="drive-car" viewBox="0 0 220 80" aria-hidden="true">
      <path className="drive-beam" d="M206 50 L420 30 L420 78 Z" />
      <path className="drive-car-body" d="M8 58 V44 Q10 36 22 35 L58 33 L82 14 Q86 11 94 11 H160 Q168 11 172 16 L190 34 Q208 37 210 46 V58 Z" />
      <path className="drive-car-glass" d="M64 33 L86 17 H124 V33 Z M130 33 V17 H160 Q164 17 167 21 L180 33 Z" />
      <rect x={204} y={42} width={7} height={6} rx={2} className="drive-headlight" />
      <rect x={6} y={42} width={5} height={6} rx={1} className="drive-taillight" />
      {[52, 166].map((x) => (
        <g key={x} transform={`translate(${x} 60)`}>
          <g className="drive-wheel">
            <circle r={15} className="drive-tyre" />
            <circle r={7} className="drive-hub" />
            <path d="M-7 0 H7 M0 -7 V7" className="drive-spoke" />
          </g>
        </g>
      ))}
    </svg>
  )
}

/** Full-screen drive, shown in place of the fade while travelling to or from somewhere far away. */
export function DriveScreen({ journey }: { journey: Journey & { homeward: boolean } }) {
  const [fact, setFact] = useState(() => Math.floor(Math.random() * FACTS.length))

  useEffect(() => {
    const timer = setInterval(() => setFact((f) => (f + 1) % FACTS.length), 3200)
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') skipJourney()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      clearInterval(timer)
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  return (
    <div
      className={`drive${journey.homeward ? ' drive-home' : ''}`}
      style={{ '--drive-ms': `${DRIVE_MS}ms`, '--strip': `${STRIP}px` } as React.CSSProperties}
      role="status"
      aria-label={`Driving to ${journey.place}`}
    >
      <div className="drive-sky">
        <div className="drive-sun" />
      </div>
      <div className="drive-strip">
        <Scenery />
      </div>
      <div className="drive-verge" />
      <div className="drive-road">
        <div className="drive-lines" />
      </div>
      <div className="drive-posts" />
      <div className="drive-car-wrap">
        <Car />
      </div>
      <div className="drive-card">
        <p className="drive-kicker">{journey.homeward ? 'Heading home' : 'On the road'}</p>
        <h2>Driving to {journey.place}</h2>
        <p className="drive-meta">
          {journey.miles} miles · about {journey.minutes} minutes · {journey.route}
        </p>
        <div className="drive-progress">
          <div className="drive-progress-fill" />
        </div>
        <p key={fact} className="drive-fact">
          {FACTS[fact]}
        </p>
        <p className="drive-skip">
          <kbd>Space</kbd> to skip ahead
        </p>
      </div>
    </div>
  )
}
