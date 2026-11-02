import { type KeyboardEvent, useEffect, useState } from 'react'
import { Panel } from '../../components/Panel.tsx'
import { REFINERY } from '../../rooms/dimensions.ts'
import { closeOverlay, openOverlay } from '../../world/overlay.ts'
import { gameStore, playerPose } from '../../world/store.ts'
import { usePlantClock } from './clock.ts'
import { stationReadings, STATIONS } from './fieldReadouts.ts'
import { MapPinIcon } from './icons.tsx'
import { dateOf } from './market.ts'
import { getPlant } from './plant.ts'
import { CHECKPOINTS } from './rounds.ts'
import { getRounds } from './roundStore.ts'
import { getSafety } from './safetyStore.ts'
import { siteBalance } from './site.ts'
import { PLAN_UNITS, standingSpot, unitStatus, type PlanUnit, type UnitStatus } from './sitePlan.ts'
import { TANKS } from './tankFarm.ts'
import { money } from './ui.tsx'
import { beaufort, compassName, downwind, windOn } from './weather.ts'
import './Refinery.css'

/** The plan's extent in site metres: the fence, with the jetty running out to the east. */
const VIEW = { x: [-35, 64] as [number, number], z: [-31, 31] as [number, number] }
const W = REFINERY.width
const L = REFINERY.length

const STATUS_TEXT: Record<UnitStatus, string> = { running: 'Running normally', warning: 'A reading is past its limit', alarm: 'In alarm', off: 'Shut down' }

/** Walks you to a unit, facing it, and closes the plan. */
function walkTo(u: PlanUnit) {
  const spot = standingSpot(u)
  closeOverlay()
  gameStore.set({ isExploring: true, arrival: { position: [spot.at[0], 1.65, spot.at[1]], yaw: spot.yaw } })
}

/** The site from above, live: every unit coloured by how it's running, you, the wind, the ships and your round. */
export function SitePlanPanel() {
  usePlantClock()
  // Redrawn every second from the live plant.
  const [, setTick] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(timer)
  }, [])
  const [selected, setSelected] = useState<string | null>(null)
  const p = getPlant()
  const s = getSafety()
  const round = getRounds().active
  const balance = siteBalance(p)
  const wind = windOn(p.tanks.day)
  const [dx, dz] = downwind(wind)
  const alarms = p.dcsAlarms.filter((a) => !a.acked && a.shelvedUntil === undefined).length
  const statuses = Object.fromEntries(PLAN_UNITS.map((u) => [u.id, unitStatus(u, p, s)])) as Record<string, UnitStatus>
  const unit = PLAN_UNITS.find((u) => u.id === selected)
  const alongside = p.tanks.ships.find((sh) => sh.berthed !== undefined && TANKS[sh.tank].cargoBy === 'ship')
  const anchored = p.tanks.ships.filter((sh) => sh !== alongside && TANKS[sh.tank].cargoBy === 'ship').length
  const drill = s.drill !== null && !s.drill.finished
  const { x: jx, z: jz, length: jl } = REFINERY.jetty

  return (
    <Panel title="Site plan" subtitle="The whole refinery from above, live: pick a unit to see it or walk there" icon={<MapPinIcon />} wide>
      <div className="cdu spl">
        <dl className="spl-strip">
          <div>
            <dt>Plant day</dt>
            <dd>
              {Math.floor(p.tanks.day) + 1} · {dateOf(p.tanks.day)}
            </dd>
          </div>
          <div>
            <dt>Site margin</dt>
            <dd className={balance.margin < 0 ? 'cdu-bad' : 'cdu-good'}>{money(balance.margin)}/day</dd>
          </div>
          <div>
            <dt>Wind</dt>
            <dd>
              {compassName(wind.from)}, {wind.speed.toFixed(0)} m/s
            </dd>
          </div>
          <div>
            <dt>Alarms waiting</dt>
            <dd className={alarms ? 'sf-warn' : 'cdu-good'}>{alarms || 'none'}</dd>
          </div>
        </dl>
        <div className="spl-grid">
          <svg className="spl-map" viewBox={`${VIEW.x[0]} ${VIEW.z[0]} ${VIEW.x[1] - VIEW.x[0]} ${VIEW.z[1] - VIEW.z[0]}`} role="img" aria-label="Plan of the refinery">
            <rect x={VIEW.x[0]} y={VIEW.z[0]} width={VIEW.x[1] - VIEW.x[0]} height={VIEW.z[1] - VIEW.z[0]} className="spl-marsh" />
            <rect x={W / 2 + 0.5} y={VIEW.z[0]} width={VIEW.x[1] - W / 2} height={VIEW.z[1] - VIEW.z[0]} className="spl-water" />
            <text x={W / 2 + 14} y={26} className="spl-water-label">
              Thames estuary
            </text>
            <rect x={-W / 2} y={-L / 2} width={W} height={L} className="spl-site" />
            {/* Roads and the pipe rack. */}
            <rect x={-3} y={-L / 2} width={6} height={L} className="spl-road" />
            <rect x={-W / 2} y={8.5} width={W} height={5} className="spl-road" />
            <rect x={REFINERY.rack.x[0]} y={REFINERY.rack.z - REFINERY.rack.width / 2} width={REFINERY.rack.x[1] - REFINERY.rack.x[0]} height={REFINERY.rack.width} className="spl-rack" />
            <rect x={-W / 2} y={-L / 2} width={W} height={L} className="spl-fence" />
            <line x1={-4} x2={4} y1={L / 2} y2={L / 2} className="spl-gate" />
            {/* The jetty and a ship alongside. */}
            <rect x={jx} y={jz - 1.2} width={jl} height={2.4} className="spl-jetty" />
            <rect x={jx + jl} y={jz - 5} width={6} height={10} className="spl-jetty" />
            {alongside && (
              <g className="spl-ship">
                <rect x={jx + jl + 6.5} y={jz - 26} width={9} height={52} rx={4} />
                <text x={jx + jl + 11} y={jz + 31} textAnchor="middle">
                  {alongside.name}
                </text>
              </g>
            )}
            {PLAN_UNITS.map((u) => {
              const status = statuses[u.id]
              const props = {
                className: `spl-unit spl-${status}${u.building ? ' spl-building' : ''}${selected === u.id ? ' spl-selected' : ''}`,
                onClick: () => setSelected(u.id),
                role: 'button',
                tabIndex: 0,
                'aria-label': `${u.name}: ${STATUS_TEXT[status]}`,
                onKeyDown: (e: KeyboardEvent) => (e.key === 'Enter' || e.key === ' ') && setSelected(u.id),
              }
              return u.shape.kind === 'circle' ? (
                <circle key={u.id} cx={u.at[0]} cy={u.at[1]} r={u.shape.radius} {...props} />
              ) : (
                <rect key={u.id} x={u.at[0] - u.shape.size[0] / 2} y={u.at[1] - u.shape.size[1] / 2} width={u.shape.size[0]} height={u.shape.size[1]} rx={0.4} {...props} />
              )
            })}
            {PLAN_UNITS.filter((u) => !u.id.startsWith('tank-') && u.id !== 'column').map((u) => (
              <text key={u.id} x={u.at[0]} y={u.at[1] + (u.shape.kind === 'circle' ? u.shape.radius + 2.4 : u.shape.size[1] / 2 + 2.2)} className="spl-label" textAnchor="middle">
                {u.name.split(' and ')[0].split(',')[0]}
              </text>
            ))}
            <text x={20} y={27} className="spl-label" textAnchor="middle">
              Tank farm
            </text>
            {/* Muster point: flashing in a drill. */}
            <g className={`spl-muster${drill ? ' spl-drill' : ''}`} transform={`translate(${REFINERY.muster[0]} ${REFINERY.muster[1]})`}>
              <rect x={-1} y={-1} width={2} height={2} />
              <text y={-1.8} textAnchor="middle" className="spl-label">
                Muster
              </text>
            </g>
            {round &&
              CHECKPOINTS.map((c, i) => (
                <g key={c.id} className={`spl-post${round.calls[c.id] ? ' done' : ''}`} transform={`translate(${c.at[0]} ${c.at[1]})`}>
                  <circle r={1.1} />
                  <text y={0.5} textAnchor="middle">
                    {i + 1}
                  </text>
                </g>
              ))}
            {/* You. */}
            <g className="spl-you" transform={`translate(${playerPose.x} ${playerPose.z}) rotate(${(-playerPose.yaw * 180) / Math.PI})`}>
              <circle r={1.4} />
              <path d="M0 -3.4 L1.3 -1 L-1.3 -1 Z" />
            </g>
            {/* Compass and wind, top right of the water. */}
            <g transform={`translate(${VIEW.x[1] - 7} ${VIEW.z[0] + 7})`} className="spl-compass">
              <circle r={5} />
              <text y={-5.8} textAnchor="middle">
                N
              </text>
              <line x1={-dx * 3.6} y1={-dz * 3.6} x2={dx * 3.6} y2={dz * 3.6} className="spl-wind" />
              <path d="M0 -1.4 L1.1 1 L-1.1 1 Z" className="spl-wind-head" transform={`translate(${dx * 3.6} ${dz * 3.6}) rotate(${(Math.atan2(dx, -dz) * 180) / Math.PI})`} />
              <text y={8.2} textAnchor="middle">
                wind
              </text>
            </g>
          </svg>
          <aside className="spl-card">
            {unit ? (
              <UnitCard unit={unit} status={statuses[unit.id]} />
            ) : (
              <>
                <h3>Pick a unit</h3>
                <p className="cdu-note">Each is coloured by how it’s running. Pick one to see its readings, walk to it, or open its screen.</p>
                <ul className="spl-legend">
                  {(['running', 'warning', 'alarm', 'off'] as UnitStatus[]).map((st) => (
                    <li key={st}>
                      <i className={`spl-${st}`} />
                      {STATUS_TEXT[st]}
                    </li>
                  ))}
                  <li>
                    <i className="spl-you-key" />
                    You
                  </li>
                </ul>
                <p className="cdu-note">
                  {beaufort(wind.speed).name} from the {compassName(wind.from)}: upwind is where to go if gas escapes.
                  {anchored > 0 && ` ${anchored} ship${anchored > 1 ? 's' : ''} waiting at anchor off the jetty.`}
                </p>
              </>
            )}
          </aside>
        </div>
      </div>
    </Panel>
  )
}

function UnitCard({ unit, status }: { unit: PlanUnit; status: UnitStatus }) {
  const station = STATIONS.find((s) => s.id === unit.station)
  const readings = station ? stationReadings(station, getPlant(), getSafety()) : []
  return (
    <>
      <h3>{unit.name}</h3>
      <p className={`spl-status spl-text-${status}`}>{STATUS_TEXT[status]}</p>
      {readings.length > 0 && (
        <dl className="spl-readings">
          {readings.map((r) => (
            <div key={r.label} className={`ur-${r.state}`}>
              <dt>{r.label}</dt>
              <dd>{r.value}</dd>
            </div>
          ))}
        </dl>
      )}
      <div className="spl-buttons">
        <button className="button button-primary" onClick={() => walkTo(unit)}>
          Walk there
        </button>
        {unit.overlay && (
          <button className="button" onClick={() => openOverlay(unit.overlay!)}>
            Open its screen
          </button>
        )}
      </div>
    </>
  )
}
