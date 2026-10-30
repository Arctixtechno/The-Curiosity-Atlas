import { Tag } from './Pfd.tsx'
import { GAS_PLANT_LIMITS, ISOM_LIMITS } from './lightEnds.ts'
import type { LightEndsResult } from './lightEndsPlant.ts'
import type { Plant } from './plant.ts'

// The gas plant, isomerisation and alkylation on one process flow diagram:
// LPG in on the left to the depropaniser, propane off the top, butanes and
// butylenes down to the alkylation contactor on the right, and light naphtha
// along the bottom through the isomerisation reactor.

const W = 960
const H = 400

export function LightEndsPfd({ plant, result }: { plant: Plant; result: LightEndsResult }) {
  const { gasPlant, isom, alky } = result
  const offSpec = gasPlant.butaneInPropane > GAS_PLANT_LIMITS.butaneInPropaneMax
  const propane = gasPlant.overhead.propane + gasPlant.overhead.propylene
  const c4 = gasPlant.bottoms.isobutane + gasPlant.bottoms.butane + gasPlant.bottoms.butylenes
  // How much of the column's height the reflux keeps wet, for the liquid level drawn on the trays.
  const wet = Math.min(1, (plant.gasPlant.reflux - 1) / 4)
  const cold = 1 - (plant.alky.temp - 2) / 14
  return (
    <svg textAnchor="middle" className="pfd" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Process flow diagram of the gas plant, isomerisation and alkylation units">
      <defs>
        <marker id="le-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0 0 L10 5 L0 10 z" fill="rgba(244,234,216,0.6)" />
        </marker>
        <linearGradient id="le-cold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7fb8e8" stopOpacity={0.15 + 0.5 * cold} />
          <stop offset="1" stopColor="#7fb8e8" stopOpacity={0.05} />
        </linearGradient>
      </defs>

      {/* LPG from three units into the depropaniser. */}
      {result.lpgSources.map((s, i) => {
        const y = 92 + i * 40
        const total = s.lpg.propane + s.lpg.propylene + s.lpg.isobutane + s.lpg.butane + s.lpg.butylenes
        return (
          <g key={s.name}>
            <text x={12} y={y - 6} className="pfd-note" textAnchor="start">
              {s.name} {total.toFixed(1)} kb/d
            </text>
            <path className={`pfd-line${total > 0.05 ? ' pfd-flow' : ' pfd-dry'}`} d={`M12 ${y} H120 V172 H150`} style={{ stroke: '#9fd0e0' }} />
          </g>
        )
      })}
      <path className="pfd-line pfd-flow" d="M120 172 H150" markerEnd="url(#le-arrow)" />
      <g className="pfd-equip">
        <rect x={150} y={60} width={40} height={250} rx={18} />
        {Array.from({ length: 10 }, (_, i) => (
          <path key={i} className="pfd-tray" d={`M${i % 2 ? 158 : 154} ${84 + i * 21} h28`} />
        ))}
        <rect x={153} y={84} width={34} height={200 * wet} className="pfd-packing" style={{ opacity: 0.35 }} />
        <text x={170} y={328} className="pfd-label">
          Depropaniser
        </text>
      </g>
      <Tag x={110} y={250} tag="FIC-801 reflux" value={`${plant.gasPlant.reflux.toFixed(2)} R`} alarm={plant.gasPlant.reflux < gasPlant.minReflux} />
      <Tag x={110} y={300} tag="QI-802 reboiler" value={`${gasPlant.duty.toFixed(1)} MW`} />

      {/* Overhead: condenser, drum, reflux back and propane out. */}
      <path className="pfd-line pfd-flow" d="M170 60 V36 H250 V50" markerEnd="url(#le-arrow)" />
      <g className="pfd-equip">
        <rect x={232} y={50} width={60} height={24} rx={12} />
        <text x={262} y={90} className="pfd-label">
          Drum
        </text>
      </g>
      <path className="pfd-line pfd-flow" d="M240 74 V100 H190" markerEnd="url(#le-arrow)" />
      <path className="pfd-line pfd-flow" d="M292 62 H340" style={{ stroke: '#9fd0e0' }} markerEnd="url(#le-arrow)" />
      <text x={346} y={58} className="pfd-product" textAnchor="start">
        Propane
      </text>
      <text x={346} y={72} className="pfd-note" textAnchor="start">
        {propane.toFixed(1)} kb/d{plant.alky.propylene ? ' (propylene to alky)' : ''}
      </text>
      <circle cx={336} cy={46} r={5} className={offSpec ? 'pfd-bad' : 'pfd-ok'} />
      <Tag x={262} y={124} tag="AI-803 C₄ in C₃" value={`${gasPlant.butaneInPropane.toFixed(2)}%`} alarm={offSpec} />

      {/* Bottoms: butanes and butylenes across to the alkylation unit. */}
      <path className="pfd-line pfd-flow" d="M170 310 V352 H560 V300" style={{ stroke: '#c8d890' }} markerEnd="url(#le-arrow)" />
      <text x={300} y={346} className="pfd-note">
        butanes and butylenes {c4.toFixed(1)} kb/d
      </text>
      {plant.alky.propylene && <path className="pfd-line pfd-flow" d="M310 62 V80 H540 V250" style={{ stroke: '#9fd0e0' }} markerEnd="url(#le-arrow)" />}

      {/* Light naphtha through isomerisation along the bottom. */}
      <text x={12} y={378} className="pfd-note" textAnchor="start">
        light naphtha {result.lightNaphtha.toFixed(1)} kb/d
      </text>
      <path className={`pfd-line pfd-flow`} d={plant.isom.running ? 'M12 386 H360 V196 H392' : 'M12 386 H940'} style={{ stroke: '#e8e2a8' }} markerEnd="url(#le-arrow)" />
      <g style={{ opacity: plant.isom.running ? 1 : 0.35 }}>
        <g className="pfd-equip">
          <rect x={392} y={150} width={36} height={90} rx={12} />
          <rect x={398} y={166} width={24} height={58} className="pfd-packing" />
          <text x={410} y={256} className="pfd-label">
            Isom reactor
          </text>
          <rect x={460} y={140} width={26} height={120} rx={12} />
          {Array.from({ length: 5 }, (_, i) => (
            <path key={i} className="pfd-tray" d={`M${i % 2 ? 468 : 464} ${158 + i * 20} h14`} />
          ))}
          <text x={473} y={276} className="pfd-label">
            DIH
          </text>
        </g>
        <path className="pfd-line pfd-flow" d="M428 196 H460" markerEnd="url(#le-arrow)" />
        {plant.isom.recycle && <path className="pfd-line pfd-flow" d="M473 260 V290 H380 V230 H392" markerEnd="url(#le-arrow)" />}
        <path className="pfd-line pfd-flow" d="M473 140 V124 H520" style={{ stroke: '#b8e08a' }} markerEnd="url(#le-arrow)" />
        <text x={500} y={114} className="pfd-product">
          Isomerate
        </text>
        <Tag x={410} y={126} tag="TIC-901" value={`${plant.isom.temp.toFixed(0)} °C`} alarm={plant.isom.temp < ISOM_LIMITS.temp.min + 25 || plant.isom.temp > 190} />
      </g>
      <text x={500} y={136} className="pfd-note" style={{ opacity: plant.isom.running ? 1 : 0.35 }}>
        {isom.octane.toFixed(1)} RON
      </text>

      {/* Alkylation: contactor, settler, acid loop and fractionator. */}
      <g className="pfd-equip">
        <rect x={540} y={250} width={110} height={50} rx={22} />
        <rect x={544} y={254} width={102} height={42} rx={20} fill="url(#le-cold)" />
        <text x={595} y={318} className="pfd-label">
          Contactor
        </text>
      </g>
      <Tag x={600} y={232} tag="TIC-1001" value={`${plant.alky.temp.toFixed(0)} °C`} />
      <path className="pfd-line pfd-flow" d="M650 275 H690" markerEnd="url(#le-arrow)" />
      <g className="pfd-equip">
        <rect x={690} y={256} width={80} height={36} rx={16} />
        <text x={730} y={310} className="pfd-label">
          Acid settler
        </text>
      </g>
      <path className="pfd-line pfd-flow" d="M730 292 V340 H620 V300" style={{ stroke: '#e0a090' }} markerEnd="url(#le-arrow)" />
      <text x={676} y={356} className="pfd-note">
        acid {plant.alky.acid.toFixed(0)}% · makeup {alky.acidUse.toFixed(1)} t/d
      </text>
      <path className="pfd-line pfd-flow" d="M730 256 V200 H800" markerEnd="url(#le-arrow)" />
      <g className="pfd-equip">
        <rect x={800} y={80} width={30} height={200} rx={14} />
        {Array.from({ length: 7 }, (_, i) => (
          <path key={i} className="pfd-tray" d={`M${i % 2 ? 808 : 804} ${100 + i * 24} h18`} />
        ))}
        <text x={815} y={298} className="pfd-label">
          Deisobutaniser
        </text>
      </g>
      <path className="pfd-line pfd-flow" d="M815 80 V50 H640 V250" markerEnd="url(#le-arrow)" />
      <text x={730} y={44} className="pfd-note">
        isobutane recycle · {plant.alky.ratio.toFixed(0)} : 1 in the feed
      </text>
      <path className="pfd-line pfd-flow" d="M830 260 H900" style={{ stroke: '#d6e8f0' }} markerEnd="url(#le-arrow)" />
      <text x={940} y={252} className="pfd-product" style={{ textAnchor: 'end' }}>
        Alkylate
      </text>
      <text x={940} y={280} className="pfd-note" textAnchor="end">
        {alky.alkylate.toFixed(1)} kb/d · {alky.octane.toFixed(1)} RON
      </text>
      <path className="pfd-line pfd-flow" d="M830 200 H900" style={{ stroke: '#9fd0e0' }} markerEnd="url(#le-arrow)" />
      <text x={940} y={192} className="pfd-note" textAnchor="end">
        butane to blending
      </text>
      {plant.alky.acid < 89 && (
        <text x={595} y={378} className="pfd-note" style={{ fill: '#ff8a6a' }}>
          weak acid: runaway risk
        </text>
      )}
    </svg>
  )
}
