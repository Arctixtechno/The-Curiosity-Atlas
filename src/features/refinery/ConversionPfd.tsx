import { FCC_LIMITS, FCC_PRODUCTS, type FccYields } from './fcc.ts'
import { Exchanger, Tag } from './Pfd.tsx'
import type { ConversionResult, Plant } from './plant.ts'
import { VDU_LIMITS } from './vdu.ts'

// The vacuum unit and cat cracker on one process flow diagram: residue in
// on the left, gas oil across the middle, cracked products out on the right.

const W = 960
const H = 420
const VAC = { x: 230, y: 40, w: 96, h: 320 }
const MAIN = { x: 775, y: 40, w: 50, h: 320 }
const RISER_X = 650
const PRODUCT_Y: Record<keyof FccYields, number> = { dryGas: 52, lpg: 108, gasoline: 172, lco: 248, slurry: 336, coke: 0 }

/** Regenerator colour: dull red at 650 °C to bright orange at 760 °C, as the catalyst would glow. */
function glow(temp: number) {
  const t = Math.min(1, Math.max(0, (temp - 650) / 110))
  const mix = (a: number, b: number) => Math.round(a + (b - a) * t)
  return `rgb(${mix(110, 240)} ${mix(40, 120)} ${mix(20, 40)})`
}

export function ConversionPfd({ plant, result }: { plant: Plant; result: ConversionResult }) {
  const { vdu, fcc } = result
  const firing = (plant.vdu.cot - VDU_LIMITS.cot.min) / (VDU_LIMITS.cot.max - VDU_LIMITS.cot.min)
  const tankNote =
    Math.abs(result.toTank) < 0.05 ? '' : result.toTank > 0 ? `${result.toTank.toFixed(1)} kb/d to tank` : `${(-result.toTank).toFixed(1)} kb/d from tank`
  return (
    <svg
      textAnchor="middle"
      className="pfd"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="Process flow diagram of the vacuum distillation unit and the fluid catalytic cracker"
    >
      <defs>
        <linearGradient id="cv-flame" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#ffde8a" />
          <stop offset="0.5" stopColor="#ff8a2a" />
          <stop offset="1" stopColor="#c2310f" stopOpacity="0" />
        </linearGradient>
        <marker id="cv-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0 0 L10 5 L0 10 z" fill="rgba(244,234,216,0.6)" />
        </marker>
      </defs>

      {/* Atmospheric residue from the crude unit into the vacuum furnace. */}
      <path className="pfd-line pfd-flow" d="M16 300 H60" markerEnd="url(#cv-arrow)" style={{ stroke: '#6b4a3a' }} />
      <text x={12} y={290} className="pfd-note" textAnchor="start">
        residue
      </text>
      <g className="pfd-equip">
        <path d="M60 340 V230 L74 208 H118 L132 230 V340 Z" />
        <rect x={84} y={160} width={24} height={48} />
        <path d="M86 290 q8 -16 0 -32 M96 310 q8 -24 0 -48 M106 290 q8 -16 0 -32" className="pfd-coil" />
        <text x={96} y={360} className="pfd-label">
          Vacuum furnace
        </text>
      </g>
      <g className="pfd-flames" style={{ opacity: 0.35 + firing * 0.65 }}>
        {[74, 96, 118].map((x) => (
          <path key={x} d={`M${x - 7} 338 Q${x} ${338 - 30 * firing - 12} ${x + 7} 338 Z`} fill="url(#cv-flame)" />
        ))}
      </g>
      <path className="pfd-line pfd-hot pfd-flow" d={`M132 260 H${VAC.x}`} markerEnd="url(#cv-arrow)" />
      <Tag
        x={181}
        y={292}
        tag="TIC-201 outlet"
        value={`${plant.vdu.cot.toFixed(0)} °C`}
        alarm={plant.vdu.cot >= VDU_LIMITS.cot.coking}
      />

      {/* The vacuum column: wide, because vapour at a twentieth of an atmosphere takes up twenty times the room. */}
      <g className="pfd-equip">
        <rect x={VAC.x} y={VAC.y} width={VAC.w} height={VAC.h} rx={VAC.w / 2} />
        {[100, 170].map((y) => (
          <g key={y}>
            <rect x={VAC.x + 8} y={y} width={VAC.w - 16} height={40} className="pfd-packing" />
            <path className="pfd-grid" d={`M${VAC.x + 8} ${y} l${VAC.w - 16} 40 M${VAC.x + 8} ${y + 40} l${VAC.w - 16} -40`} />
          </g>
        ))}
        <text x={VAC.x + VAC.w / 2} y={VAC.y + VAC.h + 22} className="pfd-label">
          Vacuum column
        </text>
      </g>
      <rect
        className="pfd-liquid"
        x={VAC.x + 6}
        y={VAC.y + VAC.h - 40}
        width={VAC.w - 12}
        height={24}
        rx={10}
        style={{ fill: '#3d2e22' }}
      />
      {plant.vdu.steam && (
        <>
          <path className="pfd-line pfd-steam" d={`M${VAC.x - 24} 330 H${VAC.x}`} />
          <text x={VAC.x - 26} y={324} className="pfd-note" textAnchor="end">
            steam
          </text>
        </>
      )}
      <path className="pfd-line pfd-flow" d={`M${VAC.x + VAC.w / 2} ${VAC.y} V18 H340`} markerEnd="url(#cv-arrow)" />
      <text x={346} y={22} className="pfd-note" textAnchor="start">
        to steam ejectors
      </text>
      <Tag x={392} y={52} tag="PIC-202 top" value={`${plant.vdu.pressure.toFixed(0)} mmHg`} />
      <path
        className="pfd-line pfd-flow"
        d={`M${VAC.x + VAC.w / 2} ${VAC.y + VAC.h} V404 H360`}
        style={{ stroke: '#5a3e30' }}
        markerEnd="url(#cv-arrow)"
      />
      <text x={366} y={400} className="pfd-note" textAnchor="start">
        vacuum residue · {vdu.residueRate.toFixed(1)} kb/d
      </text>

      {/* Vacuum gas oil across to the cat cracker, through the feed preheater. */}
      <path
        className="pfd-line pfd-flow"
        d={`M${VAC.x + VAC.w} 150 H420 V380 H${RISER_X + 8} V352`}
        style={{ stroke: '#c98b4a' }}
        markerEnd="url(#cv-arrow)"
      />
      <Tag x={372} y={116} tag="FI-203 gas oil" value={`${vdu.vgoRate.toFixed(1)} kb/d`} />
      <Tag x={372} y={190} tag="FIC-301 feed" value={`${plant.fcc.feed.toFixed(0)} kb/d`} />
      {tankNote && (
        <text x={372} y={220} className="pfd-note">
          {tankNote}
        </text>
      )}
      <Exchanger x={420} y={300} />
      <text x={414} y={334} className="pfd-note" textAnchor="end">
        {plant.fcc.preheat.toFixed(0)} °C
      </text>

      {/* Regenerator, air blower and flue gas. */}
      <g className="pfd-equip">
        <rect x={460} y={200} width={100} height={120} rx={30} />
        <rect x={464} y={240} width={92} height={76} rx={24} className="pfd-bed" style={{ fill: glow(fcc.regenTemp) }} />
        <text x={510} y={306} className="pfd-label">
          Regenerator
        </text>
      </g>
      <Tag x={510} y={232} tag="TI-303 regen" value={`${fcc.regenTemp.toFixed(0)} °C`} alarm={fcc.regenTemp > FCC_LIMITS.regenMax} />
      <path className="pfd-line pfd-flow" d="M510 346 V320" markerEnd="url(#cv-arrow)" />
      <g className="pfd-equip">
        <circle cx={510} cy={358} r={12} />
      </g>
      <text x={528} y={362} className="pfd-note" textAnchor="start">
        air · {fcc.air.toFixed(0)} t/h
      </text>
      <path className="pfd-line pfd-flow" d="M480 200 V156" markerEnd="url(#cv-arrow)" />
      <text x={480} y={148} className="pfd-note">
        flue gas
      </text>
      {plant.fcc.cooler > 0 && (
        <text x={456} y={270} className="pfd-note" textAnchor="end">
          cooler {plant.fcc.cooler.toFixed(0)} MW
        </text>
      )}

      {/* Catalyst loop: hot catalyst through the slide valve to the riser, spent catalyst back down. */}
      <path className="pfd-line pfd-cat pfd-flow" d={`M560 296 H${RISER_X}`} markerEnd="url(#cv-arrow)" />
      <path className="pfd-equip pfd-valve" d="M596 288 L612 304 V288 L596 304 Z" />
      <Tag x={604} y={334} tag="slide valve" value={`cat/oil ${fcc.catOil.toFixed(1)}`} alarm={fcc.limited !== null} />
      <path className="pfd-line pfd-cat pfd-flow" d={`M628 110 V160 H530 V200`} markerEnd="url(#cv-arrow)" />
      <text x={576} y={152} className="pfd-note">
        spent catalyst
      </text>

      {/* Riser and reactor. */}
      <g className="pfd-equip">
        <rect x={RISER_X} y={108} width={16} height={252} rx={4} />
        <rect x={615} y={40} width={86} height={70} rx={20} />
        <text x={658} y={30} className="pfd-label">
          Reactor
        </text>
        <text x={RISER_X + 34} y={356} className="pfd-label">
          Riser
        </text>
      </g>
      <Tag x={712} y={150} tag="TIC-302 riser" value={`${plant.fcc.rot.toFixed(0)} °C`} />

      {/* Cracked vapour to the main fractionator, and the products. */}
      <path className="pfd-line pfd-hot pfd-flow" d={`M701 64 H760 V300 H${MAIN.x}`} markerEnd="url(#cv-arrow)" />
      <g className="pfd-equip">
        <rect x={MAIN.x} y={MAIN.y} width={MAIN.w} height={MAIN.h} rx={MAIN.w / 2} />
        {Array.from({ length: 12 }, (_, i) => (
          <path key={i} className="pfd-tray" d={`M${MAIN.x + (i % 2 ? 12 : 6)} ${MAIN.y + 30 + i * 21} h${MAIN.w - 18}`} />
        ))}
        <text x={MAIN.x + MAIN.w / 2} y={MAIN.y + MAIN.h + 22} className="pfd-label">
          Main fractionator
        </text>
      </g>
      {FCC_PRODUCTS.filter((p) => p.id !== 'coke').map((p) => (
        <g key={p.id}>
          <path className="pfd-line pfd-flow" d={`M${MAIN.x + MAIN.w} ${PRODUCT_Y[p.id]} H846`} style={{ stroke: p.colour }} markerEnd="url(#cv-arrow)" />
          <text x={852} y={PRODUCT_Y[p.id] - 2} className="pfd-product" textAnchor="start">
            {p.name}
          </text>
          <text x={852} y={PRODUCT_Y[p.id] + 12} className="pfd-note" textAnchor="start">
            {fcc.yields[p.id].toFixed(1)} wt%
          </text>
        </g>
      ))}
    </svg>
  )
}
