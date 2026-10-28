import { Exchanger, Tag } from './Pfd.tsx'
import type { Plant, TreatingResult } from './plant.ts'
import { DHT_LIMITS, SRU_LIMITS } from './treating.ts'

// The diesel hydrotreater, the amine unit and the Claus sulphur plant on one
// process flow diagram: gas oil in on the left, road diesel out in the
// middle, H₂S across to the sulphur plant and liquid sulphur out at the bottom right.

const W = 960
const H = 400
const CONVERTER_X = [690, 755, 820]

export function TreatingPfd({ plant, result }: { plant: Plant; result: TreatingResult }) {
  const { dht, sru, hydrogen } = result
  const firing = Math.min(1, Math.max(0.2, (plant.dht.temp - 300) / 100))
  const off = Math.abs(plant.sru.air - 100) >= 4
  return (
    <svg
      textAnchor="middle"
      className="pfd"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="Process flow diagram of the diesel hydrotreater, amine unit and sulphur recovery unit"
    >
      <defs>
        <linearGradient id="tr-flame" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#ffde8a" />
          <stop offset="0.5" stopColor="#ff8a2a" />
          <stop offset="1" stopColor="#c2310f" stopOpacity="0" />
        </linearGradient>
        <marker id="tr-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0 0 L10 5 L0 10 z" fill="rgba(244,234,216,0.6)" />
        </marker>
      </defs>

      {/* Hydrogen header across the top. */}
      <path className="pfd-line pfd-flow" d="M470 34 H100 V286 H120" style={{ stroke: '#a9c9e8' }} markerEnd="url(#tr-arrow)" />
      <text x={476} y={30} className="pfd-note" textAnchor="start">
        hydrogen header: {hydrogen.supply.toFixed(0)} t/d from the reformer, {hydrogen.demand.toFixed(0)} t/d used
        {hydrogen.imported > 0 ? `, ${hydrogen.imported.toFixed(0)} t/d bought in` : `, ${hydrogen.surplus.toFixed(0)} t/d spare to fuel gas`}
      </text>

      {/* Feeds: straight-run diesel, and cycle oil from the cat cracker if taken. */}
      <text x={12} y={292} className="pfd-note" textAnchor="start">
        diesel {result.conversion.cdu.products.diesel.rate.toFixed(1)} kb/d
      </text>
      <path className="pfd-line pfd-flow" d="M12 300 H120" style={{ stroke: '#d9733c' }} />
      <text x={12} y={332} className="pfd-note" textAnchor="start">
        cycle oil {result.lco.rate.toFixed(1)} kb/d
      </text>
      <path
        className={`pfd-line${plant.dht.lco ? ' pfd-flow' : ' pfd-dry'}`}
        d="M12 340 H110 V300"
        style={{ stroke: '#b05a2c' }}
      />
      <Exchanger x={134} y={300} />
      <path className="pfd-line pfd-flow" d="M148 300 H170" markerEnd="url(#tr-arrow)" />
      <g className="pfd-equip">
        <path d="M170 330 V262 L178 250 H206 L214 262 V330 Z" />
      </g>
      <g className="pfd-flames" style={{ opacity: 0.35 + firing * 0.65 }}>
        {[184, 200].map((x) => (
          <path key={x} d={`M${x - 6} 328 Q${x} ${328 - 26 * firing - 8} ${x + 6} 328 Z`} fill="url(#tr-flame)" />
        ))}
      </g>
      <path className="pfd-line pfd-hot pfd-flow" d="M192 250 V70 H252 V86" markerEnd="url(#tr-arrow)" />
      <g className="pfd-equip">
        <rect x={230} y={86} width={44} height={200} rx={18} />
        <rect x={236} y={104} width={32} height={70} className="pfd-packing" />
        <rect x={236} y={196} width={32} height={70} className="pfd-packing" />
        <text x={252} y={304} className="pfd-label">
          Reactor
        </text>
      </g>
      <Tag x={192} y={190} tag="TIC-601 inlet" value={`${plant.dht.temp.toFixed(0)} °C`} alarm={plant.dht.temp > DHT_LIMITS.endOfRun} />
      <Tag x={310} y={70} tag="PIC-602 H₂" value={`${plant.dht.pressure.toFixed(0)} bar`} />

      {/* Separator, H₂S off to the amine unit, stripper and product. */}
      <path className="pfd-line pfd-flow" d="M252 286 V320 H290" markerEnd="url(#tr-arrow)" />
      <g className="pfd-equip">
        <rect x={290} y={306} width={60} height={30} rx={15} />
        <text x={320} y={352} className="pfd-label">
          Separator
        </text>
      </g>
      <path className="pfd-line pfd-flow" d="M350 320 H372 V290" markerEnd="url(#tr-arrow)" />
      <g className="pfd-equip">
        <rect x={360} y={130} width={26} height={160} rx={12} />
        {Array.from({ length: 6 }, (_, i) => (
          <path key={i} className="pfd-tray" d={`M${i % 2 ? 368 : 364} ${150 + i * 22} h14`} />
        ))}
        <text x={373} y={120} className="pfd-label">
          Stripper
        </text>
      </g>
      <path className="pfd-line pfd-flow" d="M386 270 H420" style={{ stroke: '#d9733c' }} markerEnd="url(#tr-arrow)" />
      <text x={402} y={250} className="pfd-product" textAnchor="start" dx={20}>
        Diesel
      </text>
      <circle cx={428} cy={276} r={5} className={dht.onSpec ? 'pfd-ok' : 'pfd-bad'} />
      <Tag x={430} y={316} tag="AI-603 sulphur" value={`${dht.sulphurOut < 1 ? dht.sulphurOut.toFixed(1) : dht.sulphurOut.toFixed(0)} ppm`} alarm={!dht.onSpec} />

      {/* Sour gas from all the hydrotreaters to the amine unit. */}
      <path className="pfd-line pfd-flow" d="M320 306 V110 H460" style={{ stroke: '#d4c24a' }} markerEnd="url(#tr-arrow)" />
      <text x={424} y={100} className="pfd-note">
        sour gas
      </text>
      <text x={503} y={204} className="pfd-note">
        + sour gas from the naphtha HT,
      </text>
      <text x={503} y={216} className="pfd-note">
        kero treater and cat cracker
      </text>
      <g className="pfd-equip">
        <rect x={462} y={60} width={26} height={70} rx={12} />
        <rect x={518} y={60} width={26} height={110} rx={12} />
        <text x={503} y={188} className="pfd-label">
          Amine unit
        </text>
      </g>
      <path className="pfd-line pfd-flow" d="M488 120 H518" markerEnd="url(#tr-arrow)" />
      <path className="pfd-line pfd-flow" d="M531 60 V46 H580 V260 H600" style={{ stroke: '#d4c24a' }} markerEnd="url(#tr-arrow)" />
      <text x={586} y={160} className="pfd-note" textAnchor="start">
        H₂S
      </text>
      <text x={586} y={172} className="pfd-note" textAnchor="start">
        {sru.feed.toFixed(0)} t/d S
      </text>

      {/* Claus furnace, air, and the catalytic converters. */}
      <g className="pfd-equip">
        <rect x={600} y={244} width={70} height={34} rx={14} />
        <text x={635} y={296} className="pfd-label">
          Claus furnace
        </text>
      </g>
      <path className="pfd-line pfd-flow" d="M610 330 V278" markerEnd="url(#tr-arrow)" />
      <text x={616} y={342} className="pfd-note" textAnchor="start">
        air {plant.sru.air.toFixed(0)}%
      </text>
      <path className="pfd-line pfd-hot pfd-flow" d="M670 261 H690 V230" markerEnd="url(#tr-arrow)" />
      {CONVERTER_X.map((x, i) => {
        const inService = i < plant.sru.converters
        const next = CONVERTER_X[i + 1]
        return (
          <g key={x} style={{ opacity: inService ? 1 : 0.35 }}>
            <g className="pfd-equip">
              <rect x={x - 16} y={170} width={32} height={60} rx={10} />
              <rect x={x - 11} y={182} width={22} height={36} className="pfd-packing" />
              <text x={x} y={162} className="pfd-label">
                C{i + 1}
              </text>
            </g>
            <path className="pfd-line pfd-flow" d={`M${x} 230 V352`} style={{ stroke: '#e8d27a' }} markerEnd="url(#tr-arrow)" />
            {next && inService && i + 1 < plant.sru.converters && (
              <path className="pfd-line pfd-flow" d={`M${x + 16} 200 H${next - 16}`} markerEnd="url(#tr-arrow)" />
            )}
          </g>
        )
      })}
      <g className="pfd-equip">
        <rect x={650} y={352} width={200} height={26} rx={4} />
        <text x={750} y={369} className="pfd-label">
          Sulphur pit · {sru.sulphur.toFixed(1)} t/d
        </text>
      </g>
      <Tag x={760} y={124} tag="AI-701 H₂S:SO₂" value={`${sru.ratio.toFixed(1)} : 1`} alarm={off} />

      {/* Tail gas unit and incinerator. */}
      {(() => {
        const last = CONVERTER_X[plant.sru.converters - 1]
        return (
          <path
            className="pfd-line pfd-flow"
            d={plant.sru.tailGas ? `M${last + 16} 190 H870 V150` : `M${last + 16} 190 H912`}
            markerEnd="url(#tr-arrow)"
          />
        )
      })()}
      <g className="pfd-equip" style={{ opacity: plant.sru.tailGas ? 1 : 0.35 }}>
        <rect x={850} y={100} width={40} height={50} rx={6} />
        <text x={870} y={92} className="pfd-label">
          Tail gas
        </text>
      </g>
      {plant.sru.tailGas && <path className="pfd-line pfd-flow" d="M890 125 H912" markerEnd="url(#tr-arrow)" />}
      <g className="pfd-equip">
        <rect x={912} y={60} width={22} height={250} rx={3} />
        <text x={923} y={326} className="pfd-label">
          Stack
        </text>
      </g>
      <text x={940} y={48} className="pfd-note" textAnchor="end" style={sru.so2 > SRU_LIMITS.so2Permit ? { fill: '#ff8a6a' } : undefined}>
        SO₂ {sru.so2.toFixed(1)} t/d
      </text>
    </svg>
  )
}
