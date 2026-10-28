import { Exchanger, Tag } from './Pfd.tsx'
import type { Plant, ReformingResult } from './plant.ts'
import { BEDS, REFORMER_LIMITS } from './reformer.ts'

// The naphtha hydrotreater and the reformer on one process flow diagram:
// naphtha in on the left, three furnace and reactor pairs across the middle,
// hydrogen and reformate out on the right.

const W = 960
const H = 400
const FEED_Y = 340
const FURNACE = { y: 230, w: 40, h: 60 }
const REACTOR_BOTTOM = 300
/** Furnace and reactor x positions for each pass. */
const PASSES = [
  { furnace: 330, reactor: 395 },
  { furnace: 470, reactor: 535 },
  { furnace: 610, reactor: 675 },
]
const REACTOR_W = 40

function reactorHeight(i: number) {
  return 60 + BEDS[i] * 150
}

export function ReformerPfd({ plant, result }: { plant: Plant; result: ReformingResult }) {
  const { nht, reformer: r, feed } = result
  const sour = nht.sulphurOut > REFORMER_LIMITS.sulphurMax
  const firing = Math.min(1, Math.max(0.15, (plant.reformer.wait - 450) / 90))
  return (
    <svg
      textAnchor="middle"
      className="pfd"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="Process flow diagram of the naphtha hydrotreater and the catalytic reformer"
    >
      <defs>
        <linearGradient id="rf-flame" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#ffde8a" />
          <stop offset="0.5" stopColor="#ff8a2a" />
          <stop offset="1" stopColor="#c2310f" stopOpacity="0" />
        </linearGradient>
        <marker id="rf-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0 0 L10 5 L0 10 z" fill="rgba(244,234,216,0.6)" />
        </marker>
      </defs>

      {/* Naphtha hydrotreater: heater, reactor, stripper. */}
      <text x={12} y={FEED_Y - 34} className="pfd-note" textAnchor="start">
        heavy naphtha
      </text>
      <path className="pfd-line pfd-flow" d={`M12 ${FEED_Y - 20} H60`} style={{ stroke: '#e8d27a' }} markerEnd="url(#rf-arrow)" />
      <Exchanger x={74} y={FEED_Y - 20} />
      <path className="pfd-line pfd-hot pfd-flow" d={`M88 ${FEED_Y - 20} H100 V108 H130 V122`} markerEnd="url(#rf-arrow)" />
      <g className="pfd-equip">
        <rect x={110} y={122} width={40} height={160} rx={18} />
        <path className="pfd-grid" d="M114 160 h32 M114 200 h32 M114 240 h32" />
        <text x={130} y={300} className="pfd-label">
          Reactor
        </text>
      </g>
      <Tag x={130} y={70} tag="TIC-401 inlet" value={`${plant.nht.temp.toFixed(0)} °C`} />
      <path className="pfd-line pfd-flow" d="M130 282 V318 H172 V250 H200" markerEnd="url(#rf-arrow)" />
      <g className="pfd-equip">
        <rect x={200} y={130} width={30} height={170} rx={14} />
        {Array.from({ length: 7 }, (_, i) => (
          <path key={i} className="pfd-tray" d={`M${i % 2 ? 210 : 204} ${152 + i * 20} h16`} />
        ))}
        <text x={215} y={318} className="pfd-label">
          Stripper
        </text>
      </g>
      <path className="pfd-line pfd-flow" d="M215 130 V100 H252" markerEnd="url(#rf-arrow)" />
      <text x={256} y={104} className="pfd-note" textAnchor="start">
        H₂S to amine unit
      </text>
      <path className="pfd-line pfd-flow" d={`M215 300 V${FEED_Y} H${PASSES[0].furnace + FURNACE.w / 2} V${FURNACE.y + FURNACE.h}`} markerEnd="url(#rf-arrow)" />
      <Tag x={262} y={372} tag="AI-402 sulphur" value={`${nht.sulphurOut < 0.1 ? nht.sulphurOut.toFixed(2) : nht.sulphurOut.toFixed(1)} ppm`} alarm={sour} />

      {/* Three furnaces and reactors in series. */}
      {PASSES.map((pass, i) => {
        const h = reactorHeight(i)
        const top = REACTOR_BOTTOM - h
        const fx = pass.furnace + FURNACE.w / 2
        const rx = pass.reactor + REACTOR_W / 2
        const outlet = plant.reformer.wait - r.drops[i]
        const next = PASSES[i + 1]
        return (
          <g key={i}>
            <g className="pfd-equip">
              <path d={`M${pass.furnace} ${FURNACE.y + FURNACE.h} V${FURNACE.y + 12} L${pass.furnace + 8} ${FURNACE.y} H${pass.furnace + FURNACE.w - 8} L${pass.furnace + FURNACE.w} ${FURNACE.y + 12} V${FURNACE.y + FURNACE.h} Z`} />
              <text x={fx} y={FURNACE.y + 26} className="pfd-label">
                F{i + 1}
              </text>
            </g>
            <g className="pfd-flames" style={{ opacity: 0.35 + firing * 0.65 }}>
              {[-10, 10].map((dx) => (
                <path
                  key={dx}
                  d={`M${fx + dx - 6} ${FURNACE.y + FURNACE.h - 2} Q${fx + dx} ${FURNACE.y + FURNACE.h - 2 - 26 * firing - 8} ${fx + dx + 6} ${FURNACE.y + FURNACE.h - 2} Z`}
                  fill="url(#rf-flame)"
                />
              ))}
            </g>
            <path className="pfd-line pfd-hot pfd-flow" d={`M${fx} ${FURNACE.y} V${top - 16} H${rx} V${top}`} markerEnd="url(#rf-arrow)" />
            <g className="pfd-equip">
              <rect x={pass.reactor} y={top} width={REACTOR_W} height={h} rx={16} />
              <rect x={pass.reactor + 5} y={top + 14} width={REACTOR_W - 10} height={h - 28} className="pfd-packing" />
              <text x={rx} y={REACTOR_BOTTOM + 16} className="pfd-label">
                R{i + 1}
              </text>
            </g>
            <path
              className="pfd-line pfd-flow"
              d={next ? `M${rx} ${REACTOR_BOTTOM} V${FEED_Y} H${next.furnace + FURNACE.w / 2} V${FURNACE.y + FURNACE.h}` : `M${rx} ${REACTOR_BOTTOM} V${FEED_Y} H748`}
              markerEnd="url(#rf-arrow)"
            />
            <Tag x={rx} y={FEED_Y + 30} tag={`TI-50${i + 1} R${i + 1} out`} value={`${outlet.toFixed(0)} °C`} />
          </g>
        )
      })}
      <Tag x={PASSES[1].furnace + FURNACE.w / 2} y={44} tag="TIC-501 inlets" value={`${plant.reformer.wait.toFixed(0)} °C`} alarm={plant.reformer.wait > REFORMER_LIMITS.waitMax} />

      {/* Separator, recycle compressor and net hydrogen. */}
      <Exchanger x={762} y={FEED_Y} />
      <path className="pfd-line pfd-flow" d={`M776 ${FEED_Y} H792 V300`} markerEnd="url(#rf-arrow)" />
      <g className="pfd-equip">
        <rect x={760} y={266} width={64} height={34} rx={17} />
        <text x={792} y={287} className="pfd-label">
          Separator
        </text>
      </g>
      <path className="pfd-line pfd-flow" d="M792 266 V208" markerEnd="url(#rf-arrow)" />
      <g className="pfd-equip">
        <circle cx={792} cy={194} r={14} />
        <path className="pfd-grid" d="M784 188 L800 194 L784 200" />
      </g>
      <path className="pfd-line pfd-reflux pfd-flow" d={`M778 194 H760 V18 H300 V${FEED_Y - 8} H${PASSES[0].furnace}`} markerEnd="url(#rf-arrow)" />
      <text x={530} y={12} className="pfd-note">
        recycle hydrogen · {plant.reformer.h2hc.toFixed(1)} mol per mol of naphtha · {plant.reformer.pressure.toFixed(0)} bar
      </text>
      <path className="pfd-line pfd-flow" d="M806 194 H836" style={{ stroke: '#a9c9e8' }} markerEnd="url(#rf-arrow)" />
      <text x={842} y={190} className="pfd-product" textAnchor="start">
        Hydrogen
      </text>
      <text x={842} y={204} className="pfd-note" textAnchor="start">
        {r.hydrogen.toFixed(0)} t/d
      </text>

      {/* Stabiliser: LPG off the top, reformate from the bottom. */}
      <path className="pfd-line pfd-flow" d="M824 290 H834 V260 H840" markerEnd="url(#rf-arrow)" />
      <g className="pfd-equip">
        <rect x={840} y={226} width={26} height={110} rx={12} />
        <text x={853} y={352} className="pfd-label">
          Stabiliser
        </text>
      </g>
      <path className="pfd-line pfd-flow" d="M866 240 H886" style={{ stroke: '#9fd0e0' }} markerEnd="url(#rf-arrow)" />
      <text x={892} y={236} className="pfd-product" textAnchor="start">
        LPG
      </text>
      <text x={892} y={250} className="pfd-note" textAnchor="start">
        {r.yields.lpg.toFixed(1)} wt%
      </text>
      <path className="pfd-line pfd-flow" d="M866 320 H886" style={{ stroke: '#f0c050' }} markerEnd="url(#rf-arrow)" />
      <text x={892} y={300} className="pfd-product" textAnchor="start">
        Reformate
      </text>
      <text x={892} y={314} className="pfd-note" textAnchor="start">
        {r.octane.toFixed(1)} RON
      </text>
      <text x={892} y={336} className="pfd-note" textAnchor="start">
        {r.yields.reformate.toFixed(1)} wt%
      </text>
      <text x={12} y={22} className="pfd-crude">
        {feed.rate.toFixed(1)} kb/d of heavy naphtha
      </text>
    </svg>
  )
}
