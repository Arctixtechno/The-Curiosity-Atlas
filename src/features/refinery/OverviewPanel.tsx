import { useState } from 'react'
import { Panel } from '../../components/Panel.tsx'
import { RefineryIcon } from './icons.tsx'
import { BOARD_BOX, BOARD_LAYOUT, CDU_BOX, OUTPUTS, STREAMS, UNITS, type ProductOut, type UnitId } from './units.ts'
import './Refinery.css'

const W = 960
const H = 520
const OUT_X = 812

function box(id: UnitId) {
  const [x, y] = BOARD_LAYOUT[id]
  const { w, h } = id === 'cdu' ? CDU_BOX : BOARD_BOX
  return { x, y, w, h }
}

interface Route {
  d: string
  /** Where the stream's label goes, and which way it reads from there. */
  label: { x: number; y: number; anchor: 'start' | 'end' }
}

/**
 * How a stream is drawn from `from` to `to`: out of the source's right side,
 * one vertical run, and into the target's left side. Labels sit just before
 * the unit a stream feeds, or just after the unit a product leaves.
 */
function route(from: UnitId | 'crude', to: UnitId | ProductOut, index: number): Route {
  const start = from === 'crude' ? { x: 72, y: 230 } : (() => {
    const b = box(from)
    return { x: b.x + b.w, y: b.y + b.h / 2 }
  })()
  const toProduct = to in OUTPUTS
  const target = toProduct ? null : box(to as UnitId)
  const end = target ? { x: target.x, y: target.y + target.h / 2 } : { x: OUT_X, y: OUTPUTS[to as ProductOut].y }
  // Streams leaving the tall crude unit leave at the height they arrive.
  if (from === 'cdu') start.y = Math.min(Math.max(end.y, box('cdu').y + 10), box('cdu').y + box('cdu').h - 10)
  if (target && from !== 'crude' && target.x === box(from).x) {
    const source = box(from)
    if (target.y > source.y) {
      // Straight down to the unit below (amine unit to the sulphur plant).
      const x = source.x + source.w / 2
      return { d: `M${x} ${source.y + source.h} V${target.y}`, label: { x: x + 8, y: (source.y + source.h + target.y) / 2 + 4, anchor: 'start' } }
    }
    // Back up the same column, round the left side (cat cracker olefins to alkylation).
    const x = source.x - 16
    return {
      d: `M${source.x} ${source.y + source.h / 2} H${x} V${end.y} H${target.x}`,
      label: { x: x - 4, y: (source.y + end.y) / 2 + 40, anchor: 'end' },
    }
  }
  const elbow = start.x + 14 + (index % 4) * 4
  const d = start.y === end.y ? `M${start.x} ${start.y} H${end.x}` : `M${start.x} ${start.y} H${elbow} V${end.y} H${end.x}`
  return {
    d,
    label: toProduct ? { x: start.x + 4, y: start.y - 5, anchor: 'start' } : { x: end.x - 6, y: end.y - 5, anchor: 'end' },
  }
}

/** The site board by the gate: the whole refinery as a block diagram, and what every unit does. */
export function OverviewPanel() {
  const [selected, setSelected] = useState<UnitId>('cdu')
  const unit = UNITS[selected]
  return (
    <Panel title="How a refinery works" subtitle="The site board at Marshgate: follow a barrel of crude from tank to tanker" icon={<RefineryIcon />} wide>
      <div className="board">
        <svg textAnchor="middle" className="board-diagram" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Block flow diagram of the refinery">
          <defs>
            <marker id="board-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M0 0 L10 5 L0 10 z" fill="rgba(244,234,216,0.55)" />
            </marker>
          </defs>
          <g className="board-equip-static">
            <rect x={16} y={200} width={56} height={60} rx={6} />
            <text x={44} y={278}>
              Crude
            </text>
          </g>
          {STREAMS.map(([from, to, label], i) => {
            const { d, label: at } = route(from, to, i)
            const active = from === selected || to === selected
            return (
              <g key={`${from}-${to}`} className={`board-stream${active ? ' board-stream-active' : ''}`}>
                <path d={d} markerEnd="url(#board-arrow)" />
                {label && (
                  <text x={at.x} y={at.y} textAnchor={at.anchor}>
                    {label}
                  </text>
                )}
              </g>
            )
          })}
          {(Object.keys(UNITS) as UnitId[]).map((id) => {
            const { x, y, w, h } = box(id)
            const u = UNITS[id]
            return (
              <g
                key={id}
                className={`board-unit${selected === id ? ' board-unit-selected' : ''}${u.stage === 1 ? ' board-unit-live' : ''}`}
                role="button"
                tabIndex={0}
                aria-label={u.name}
                aria-pressed={selected === id}
                onClick={() => setSelected(id)}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setSelected(id))}
              >
                <rect x={x} y={y} width={w} height={h} rx={8} />
                <text x={x + w / 2} y={y + h / 2 + 4}>
                  {u.short}
                </text>
              </g>
            )
          })}
          {(Object.keys(OUTPUTS) as ProductOut[]).map((id) => (
            <g key={id} className="board-output">
              <text x={OUT_X + 8} y={OUTPUTS[id].y + 4}>
                {OUTPUTS[id].name}
              </text>
            </g>
          ))}
        </svg>
        <article className="board-card" aria-live="polite">
          <div className="board-card-head">
            <h3>{unit.name}</h3>
            <span className={`board-stage${unit.stage === 1 ? ' board-stage-live' : ''}`}>
              {unit.stage === 1 ? (unit.id === 'cdu' ? 'Run it here' : 'Part of the crude unit') : `Opens in stage ${unit.stage}`}
            </span>
          </div>
          <p>{unit.does}</p>
          <h4>Runs at</h4>
          <ul>
            {unit.conditions.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          {unit.chemistry && (
            <>
              <h4>Chemistry</h4>
              <p className="board-chem">{unit.chemistry}</p>
            </>
          )}
          <h4>Why it matters</h4>
          <p>{unit.why}</p>
        </article>
      </div>
      <p className="muted">
        Click any unit to read about it. Lines show where each stream goes; the ones touching the unit you've picked are lit. The crude
        unit is the one you can run today, from its column in the middle of the site or from the control room. The cat cracker and
        vacuum unit come next, then the reformer and its hydrotreater.
      </p>
    </Panel>
  )
}
