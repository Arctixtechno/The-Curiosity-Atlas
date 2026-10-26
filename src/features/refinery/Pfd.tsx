import type { CduResult, ProductId } from './cdu.ts'
import { PRODUCTS } from './cdu.ts'
import { CRUDES } from './crudes.ts'
import { measured } from './furnace.ts'
import type { Plant } from './plant.ts'

// The crude unit's process flow diagram, drawn the way it would be on a
// control room screen, with live readings on every stream.

const W = 960
const H = 400
const COLUMN = { x: 500, y: 34, w: 74, h: 330 }
/** Heights of the side draws on the column. */
const DRAW_Y: Record<'kerosene' | 'diesel', number> = { kerosene: 168, diesel: 238 }
const PRODUCT_Y: Record<ProductId, number> = { gas: 52, naphtha: 112, kerosene: 182, diesel: 252, residue: 340 }

function colour(id: ProductId) {
  return PRODUCTS.find((p) => p.id === id)!.colour
}

/** A reading in a small tag bubble, like an instrument on a P&ID. */
function Tag({ x, y, tag, value, alarm }: { x: number; y: number; tag: string; value: string; alarm?: boolean }) {
  return (
    <g className={`pfd-tag${alarm ? ' pfd-tag-alarm' : ''}`} transform={`translate(${x} ${y})`}>
      <rect x={-46} y={-15} width={92} height={30} rx={6} />
      <text y={-3}>{tag}</text>
      <text y={10} className="pfd-tag-value">
        {value}
      </text>
    </g>
  )
}

export function Pfd({ plant, result }: { plant: Plant; result: CduResult }) {
  const f = plant.furnace
  const pv = measured(f)
  const firing = f.tripped ? 0 : f.valve / 100
  const { products } = result
  const flowing = (id: ProductId) => products[id].percent > 0.05
  const hot = f.outlet >= 372
  return (
    <svg textAnchor="middle" className="pfd" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Process flow diagram of the crude distillation unit">
      <defs>
        <linearGradient id="pfd-flame" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#ffde8a" />
          <stop offset="0.5" stopColor="#ff8a2a" />
          <stop offset="1" stopColor="#c2310f" stopOpacity="0" />
        </linearGradient>
        <marker id="pfd-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0 0 L10 5 L0 10 z" fill="rgba(244,234,216,0.6)" />
        </marker>
      </defs>

      {/* Crude from the tank, through the preheat train and desalter, to the furnace. */}
      <g className="pfd-equip">
        <rect x={16} y={258} width={70} height={70} rx={4} />
        <text x={51} y={348} className="pfd-label">
          Crude tank
        </text>
      </g>
      <path className="pfd-line pfd-flow" d="M86 300 H118" markerEnd="url(#pfd-arrow)" />
      <Exchanger x={136} y={300} />
      <path className="pfd-line pfd-flow" d="M154 300 H186" />
      <g className="pfd-equip">
        <rect x={186} y={284} width={74} height={32} rx={16} />
        <path d="M198 300 h50" className="pfd-grid" />
        <text x={223} y={336} className="pfd-label">
          Desalter
        </text>
      </g>
      <path className="pfd-line pfd-flow" d="M260 300 H288" />
      <Exchanger x={306} y={300} />
      <path className="pfd-line pfd-flow" d="M324 300 H352 V250" markerEnd="url(#pfd-arrow)" />
      <text x={190} y={272} className="pfd-note">
        preheat train · 265 °C
      </text>
      <Tag x={110} y={236} tag="FIC-100 crude" value={`${f.feed.toFixed(0)} kb/d`} />

      {/* Furnace: radiant box with burners, convection section, stack. */}
      <g className="pfd-equip">
        <path d="M322 250 V140 L340 112 H392 L410 140 V250 Z" />
        <rect x={350} y={60} width={32} height={52} />
        <path d="M356 168 q10 -20 0 -40 M366 200 q10 -30 0 -60 M376 168 q10 -20 0 -40" className="pfd-coil" />
        <text x={366} y={268} className="pfd-label">
          Furnace
        </text>
      </g>
      {firing > 0 && (
        <g className="pfd-flames" style={{ opacity: 0.35 + firing * 0.65 }}>
          {[338, 366, 394].map((x) => (
            <path key={x} d={`M${x - 8} 248 Q${x} ${248 - 40 * firing - 14} ${x + 8} 248 Z`} fill="url(#pfd-flame)" />
          ))}
        </g>
      )}
      <Tag x={258} y={116} tag="FV-101 fuel" value={f.tripped ? 'TRIPPED' : `${f.valve.toFixed(0)}% open`} alarm={f.tripped} />

      {/* Transfer line into the column's flash zone. */}
      <path className="pfd-line pfd-hot pfd-flow" d={`M410 200 H${COLUMN.x}`} markerEnd="url(#pfd-arrow)" />
      <Tag x={452} y={228} tag="TIC-101 outlet" value={`${pv.toFixed(1)} °C`} alarm={hot || f.tripped} />

      {/* The column, its trays and the flash zone. */}
      <g className="pfd-equip">
        <rect x={COLUMN.x} y={COLUMN.y} width={COLUMN.w} height={COLUMN.h} rx={COLUMN.w / 2} />
        {Array.from({ length: 13 }, (_, i) => {
          const y = COLUMN.y + 36 + i * 13
          return <path key={i} className="pfd-tray" d={`M${COLUMN.x + (i % 2 ? 14 : 6)} ${y} h${COLUMN.w - 20}`} />
        })}
        {Array.from({ length: 5 }, (_, i) => {
          const y = 262 + i * 13
          return <path key={i} className="pfd-tray" d={`M${COLUMN.x + (i % 2 ? 14 : 6)} ${y} h${COLUMN.w - 20}`} />
        })}
        <text x={COLUMN.x + COLUMN.w / 2} y={COLUMN.y + COLUMN.h + 22} className="pfd-label">
          Atmospheric column
        </text>
      </g>
      <rect
        className="pfd-liquid"
        x={COLUMN.x + 4}
        y={COLUMN.y + COLUMN.h - 34}
        width={COLUMN.w - 8}
        height={22}
        rx={8}
        style={{ fill: colour('residue') }}
      />

      {/* Overhead: condenser, reflux drum, gas and naphtha, and reflux back to the top tray. */}
      <path className="pfd-line pfd-flow" d={`M${COLUMN.x + COLUMN.w / 2} ${COLUMN.y} V18 H640 V36`} />
      <g className="pfd-equip">
        <rect x={616} y={36} width={48} height={18} />
        <path d="M624 36 v18 M632 36 v18 M640 36 v18 M648 36 v18 M656 36 v18" className="pfd-grid" />
        <text x={706} y={30} className="pfd-label">
          Air cooler
        </text>
      </g>
      <path className="pfd-line pfd-flow" d="M640 54 V78" />
      <g className="pfd-equip">
        <rect x={606} y={78} width={88} height={30} rx={15} />
        <text x={650} y={124} className="pfd-label">
          Reflux drum
        </text>
      </g>
      <path className="pfd-line pfd-reflux pfd-flow" d={`M612 108 V128 H596 V60 H${COLUMN.x + COLUMN.w}`} markerEnd="url(#pfd-arrow)" />
      <text x={590} y={142} className="pfd-note">
        reflux
      </text>
      <Tag x={432} y={50} tag="TIC-102 top" value={`${plant.column.topTemp.toFixed(0)} °C`} />
      <Stream id="gas" from="M694 84 H780" y={PRODUCT_Y.gas} result={result} flowing={flowing('gas')} />
      <Stream id="naphtha" from={`M690 104 Q720 112 780 ${PRODUCT_Y.naphtha}`} y={PRODUCT_Y.naphtha} result={result} flowing={flowing('naphtha')} />

      {/* Side draws through their steam strippers. */}
      {(['kerosene', 'diesel'] as const).map((id) => (
        <g key={id}>
          <path className={`pfd-line${flowing(id) ? ' pfd-flow' : ' pfd-dry'}`} d={`M${COLUMN.x + COLUMN.w} ${DRAW_Y[id]} H636`} />
          <g className="pfd-equip">
            <rect x={636} y={DRAW_Y[id] - 26} width={28} height={64} rx={14} />
          </g>
          <path className="pfd-line pfd-steam" d={`M650 ${DRAW_Y[id] + 54} V${DRAW_Y[id] + 38}`} />
          <path className="pfd-line pfd-flow" d={`M636 ${DRAW_Y[id] - 18} H${COLUMN.x + COLUMN.w}`} markerEnd="url(#pfd-arrow)" />
          <Stream id={id} from={`M664 ${DRAW_Y[id] + 14} H780`} y={PRODUCT_Y[id]} result={result} flowing={flowing(id)} />
          <Tag
            x={724}
            y={DRAW_Y[id] - 12}
            tag={id === 'kerosene' ? 'FIC-103' : 'FIC-104'}
            value={`${products[id].percent.toFixed(1)}%`}
            alarm={id === 'diesel' && result.starved}
          />
        </g>
      ))}
      <text x={650} y={308} className="pfd-note">
        stripping steam
      </text>

      {/* Bottoms: stripped by steam, then out as atmospheric residue. */}
      <path className="pfd-line pfd-steam" d={`M${COLUMN.x - 20} 352 H${COLUMN.x}`} />
      <Stream
        id="residue"
        from={`M${COLUMN.x + COLUMN.w / 2} ${COLUMN.y + COLUMN.h} V384 H760 V${PRODUCT_Y.residue} H780`}
        y={PRODUCT_Y.residue}
        result={result}
        flowing
      />
      <text x={COLUMN.x - 24} y={346} className="pfd-note" textAnchor="end">
        steam
      </text>
      <text x={16} y={22} className="pfd-crude">
        {CRUDES[f.crude].name} · {f.feed.toFixed(0)} thousand barrels a day
      </text>
    </svg>
  )
}

function Exchanger({ x, y }: { x: number; y: number }) {
  return (
    <g className="pfd-equip">
      <circle cx={x} cy={y} r={14} />
      <path d={`M${x - 10} ${y + 6} l6 -12 l6 12 l6 -12`} className="pfd-grid" />
    </g>
  )
}

/** A product line leaving the unit, with its rate and whether it is on spec. */
function Stream({ id, from, y, result, flowing }: { id: ProductId; from: string; y: number; result: CduResult; flowing: boolean }) {
  const p = result.products[id]
  const meta = PRODUCTS.find((m) => m.id === id)!
  return (
    <g>
      <path className={`pfd-line${flowing ? ' pfd-flow' : ' pfd-dry'}`} d={from} style={{ stroke: meta.colour }} />
      <path className="pfd-line" d={`M780 ${y} H800`} style={{ stroke: meta.colour }} markerEnd="url(#pfd-arrow)" />
      <g transform={`translate(806 ${y})`}>
        <circle cx={6} cy={-4} r={5} className={p.onSpec ? 'pfd-ok' : 'pfd-bad'} />
        <text x={16} y={0} className="pfd-product">
          {meta.name}
        </text>
        <text x={16} y={14} className="pfd-note" textAnchor="start">
          {p.rate.toFixed(1)} kb/d · {p.percent.toFixed(1)}%
        </text>
      </g>
    </g>
  )
}
