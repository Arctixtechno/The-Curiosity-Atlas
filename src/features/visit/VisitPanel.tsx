import { MAP_OVERLAY } from '../../components/MapPanel.tsx'
import { Panel } from '../../components/Panel.tsx'
import { CheckIcon, CompassIcon } from '../../components/icons.tsx'
import { rooms } from '../../rooms/registry.ts'
import { useLibrary } from '../../services/library.ts'
import { openOverlay } from '../../world/overlay.ts'
import { useVisited } from '../../world/visited.ts'
import { useVisitLog } from '../../world/visitLog.ts'
import { DRINKS } from '../cafe/drinks.ts'
import { CAFE_OVERLAY } from '../cafe/overlayId.ts'
import { CINEMA_OVERLAY } from '../cinema/CinemaPanel.tsx'
import { BUOYANCY_OVERLAY, GAS_OVERLAY } from '../experiments/overlayIds.ts'
import { EXHIBIT_IDS, exhibitOverlay, type ExhibitId } from '../museum/overlayId.ts'
import { SOLAR_OVERLAY } from '../solar/overlayId.ts'
import { ALL_PLACES } from '../tourism/places.ts'
import { usePassport } from '../tourism/passport.ts'
import { CITY_EXPLORER_OVERLAY } from '../tourism/overlayId.ts'
import { CIRCUIT_OVERLAY, GEARS_OVERLAY } from '../workshop/overlayIds.ts'
import './VisitPanel.css'

/** The things to try around the house, by the panel each one opens. */
const TRIED: { id: string; label: string; where: string }[] = [
  { id: 'fountain', label: "Today's question at the fountain", where: 'Courtyard' },
  { id: 'lounge', label: 'A conversation by the fire', where: 'Philosophy Lounge' },
  { id: GAS_OVERLAY, label: 'Gas pressure', where: 'Laboratory' },
  { id: BUOYANCY_OVERLAY, label: 'The buoyancy tank', where: 'Laboratory' },
  { id: GEARS_OVERLAY, label: 'The gear train', where: 'Workshop' },
  { id: CIRCUIT_OVERLAY, label: 'The circuit board', where: 'Workshop' },
  { id: SOLAR_OVERLAY, label: 'The solar system', where: 'Observatory' },
  { id: CITY_EXPLORER_OVERLAY, label: 'The City Explorer', where: 'Main Hall' },
  { id: CINEMA_OVERLAY, label: 'A film', where: 'Theatre' },
  { id: CAFE_OVERLAY, label: 'The café counter', where: 'Café' },
]

const EXHIBIT_NAMES: Record<ExhibitId, string> = {
  rosetta: 'The Rosetta Stone',
  meteorite: 'The meteorite',
  astrolabe: 'The astrolabe',
  chronometer: 'The marine chronometer',
  ammonite: 'The ammonite',
  antikythera: 'The Antikythera mechanism',
}

/** Reads the fountain's run of days without counting today as a visit. */
function fountainDays() {
  try {
    const saved = JSON.parse(localStorage.getItem('atlas.fountainDays') ?? 'null') as { last: string; days: number } | null
    const recent = [new Date(), new Date(Date.now() - 86_400_000)].map((d) => d.toDateString())
    return saved && recent.includes(saved.last) ? saved.days : 0
  } catch {
    return 0
  }
}

function Meter({ done, of }: { done: number; of: number }) {
  return (
    <div className="visit-meter" role="meter" aria-valuemin={0} aria-valuemax={of} aria-valuenow={done}>
      <span style={{ width: `${(100 * done) / of}%` }} />
    </div>
  )
}

function Section({ title, done, of, children }: { title: string; done: number; of: number; children: React.ReactNode }) {
  return (
    <section className="visit-section">
      <header>
        <h3>{title}</h3>
        <span className="visit-count">
          {done} of {of}
        </span>
      </header>
      <Meter done={done} of={of} />
      {children}
    </section>
  )
}

function Ticks({ items }: { items: { key: string; label: string; done: boolean; note?: string }[] }) {
  return (
    <ul className="visit-ticks">
      {items.map((i) => (
        <li key={i.key} className={i.done ? 'visit-done' : undefined}>
          <span className="visit-box">{i.done && <CheckIcon size={12} />}</span>
          <span>
            {i.label}
            {i.note && <span className="muted"> · {i.note}</span>}
          </span>
        </li>
      ))}
    </ul>
  )
}

/** Everything you've seen and done in the house so far, with what's still waiting. */
export function VisitPanel() {
  const visited = useVisited()
  const log = useVisitLog()
  const library = useLibrary()
  const passport = usePassport()
  const roomList = Object.values(rooms)
  const opened = new Set(log.opened)
  const exhibitsSeen = EXHIBIT_IDS.filter((id) => opened.has(exhibitOverlay(id)))
  const triedCount = TRIED.filter((t) => opened.has(t.id)).length
  const places = Object.values(passport)
  const been = places.filter((p) => p.visited).length
  const loved = places.filter((p) => p.favourite).length
  const discoveries = library.filter((i) => i.kind === 'discovery').length
  const insights = library.length - discoveries
  const days = fountainDays()
  const since = new Date(log.since + 'T12:00:00').toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <Panel title="Your visit" subtitle={`Everything you've found since ${since}`} icon={<CompassIcon />} wide>
      <div className="visit-summary">
        <div>
          <strong>{library.length}</strong>
          <span>
            saved to the library
            <span className="muted">
              {' '}
              ({discoveries} {discoveries === 1 ? 'discovery' : 'discoveries'}, {insights}{' '}
              {insights === 1 ? 'insight' : 'insights'})
            </span>
          </span>
        </div>
        <div>
          <strong>{days}</strong>
          <span>{days === 1 ? 'day' : 'days'} in a row at the fountain</span>
        </div>
        <div>
          <strong>{been}</strong>
          <span>
            London places visited <span className="muted">({loved} favourites)</span>
          </span>
        </div>
      </div>

      <div className="visit-grid">
        <Section title="Rooms" done={roomList.filter((r) => visited.has(r.id)).length} of={roomList.length}>
          <Ticks items={roomList.map((r) => ({ key: r.id, label: r.displayName, done: visited.has(r.id) }))} />
          <button className="button button-quiet" onClick={() => openOverlay(MAP_OVERLAY)}>
            Open the map
          </button>
        </Section>
        <Section title="Things to try" done={triedCount} of={TRIED.length}>
          <Ticks items={TRIED.map((t) => ({ key: t.id, label: t.label, done: opened.has(t.id), note: t.where }))} />
        </Section>
        <Section title="Museum exhibits" done={exhibitsSeen.length} of={EXHIBIT_IDS.length}>
          <Ticks items={EXHIBIT_IDS.map((id) => ({ key: id, label: EXHIBIT_NAMES[id], done: exhibitsSeen.includes(id) }))} />
        </Section>
        <Section title="Drinks made" done={log.drinks.length} of={DRINKS.length}>
          <Ticks items={DRINKS.map((d) => ({ key: d.id, label: d.name, done: log.drinks.includes(d.id) }))} />
        </Section>
      </div>
      <p className="muted visit-foot">
        {been} of {ALL_PLACES.length} London places ticked off in the City Explorer's passport. Kept in this browser only.
      </p>
    </Panel>
  )
}
