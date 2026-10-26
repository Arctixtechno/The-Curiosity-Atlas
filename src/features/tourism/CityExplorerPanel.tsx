import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Panel } from '../../components/Panel.tsx'
import { CompassIcon } from '../../components/icons.tsx'
import { planWalk } from './geo.ts'
import {
  ALL_PLACES,
  groupOf,
  KIND_NAMES,
  NEIGHBOURHOODS,
  neighbourhoodOf,
  PLACE_GROUPS,
  type Neighbourhood,
  type Place,
  type PlaceGroupId,
} from './places.ts'
import { clearCityExplorerFocus, peekCityExplorerFocus } from './focus.ts'
import { updatePassport, usePassport } from './passport.ts'
import './CityExplorerPanel.css'

const WALK_LENGTHS = [60, 120, 180, 240]
const COLOURS = { visited: '#8a929c', selected: '#fff4dc', edge: '#2a1d12' }

/** Each place is coloured by its group, and greyed once you've been. */
function markerColour(place: Place, visited: boolean) {
  return visited ? COLOURS.visited : groupOf(place.kind).colour
}

/** Scrolls the row of tabs, and only the row, so the chosen one is in view. */
function showTab(tab: HTMLElement | null) {
  const row = tab?.parentElement
  if (!tab || !row) return
  const margin = 32
  if (tab.offsetLeft < row.scrollLeft + margin) row.scrollLeft = tab.offsetLeft - margin
  else if (tab.offsetLeft + tab.offsetWidth > row.scrollLeft + row.clientWidth - margin)
    row.scrollLeft = tab.offsetLeft + tab.offsetWidth - row.clientWidth + margin
}

function formatMinutes(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h ? `${h} h${m ? ` ${m} min` : ''}` : `${m} min`
}

/**
 * The London map from the map table: neighbourhood guides on a free
 * OpenStreetMap map, a Discovery Passport of places visited and loved, and a
 * simple walk planner.
 */
export function CityExplorerPanel() {
  // Opened from the spyglass at a landmark: start on that place.
  const [focus] = useState(peekCityExplorerFocus)
  useEffect(clearCityExplorerFocus, [])
  const [area, setArea] = useState<Neighbourhood>(() => (focus && neighbourhoodOf(focus)) || NEIGHBOURHOODS[0])
  const [selectedId, setSelectedId] = useState<string | null>(focus)
  const [walkLength, setWalkLength] = useState<number | null>(null)
  const [group, setGroup] = useState<PlaceGroupId | null>(null)
  const passport = usePassport()

  const shown = group ? area.places.filter((p) => groupOf(p.kind).id === group) : area.places
  const selected = area.places.find((p) => p.id === selectedId) ?? null
  const walk = useMemo(
    () =>
      walkLength
        ? planWalk(
            shown.filter((p) => !passport[p.id]?.visited),
            area.centre,
            walkLength,
          )
        : null,
    [area, walkLength, passport, shown],
  )

  const visitedCount = ALL_PLACES.filter((p) => passport[p.id]?.visited).length
  const favourites = ALL_PLACES.filter((p) => passport[p.id]?.favourite)

  const chooseArea = (n: Neighbourhood) => {
    setArea(n)
    setGroup(null)
    setSelectedId(null)
    setWalkLength(null)
  }

  const areaVisited = area.places.filter((p) => passport[p.id]?.visited).length

  return (
    <Panel
      title="City Explorer · London"
      subtitle="Places worth knowing, on a living map"
      icon={<CompassIcon />}
      wide
      className="panel-city"
    >
      <nav className="city-areas" role="tablist" aria-label="Neighbourhoods">
        {NEIGHBOURHOODS.map((n) => (
          <button
            key={n.id}
            role="tab"
            aria-selected={n.id === area.id}
            className="city-area"
            onClick={() => chooseArea(n)}
            ref={n.id === area.id ? showTab : undefined}
          >
            {n.name}
          </button>
        ))}
      </nav>

      <div className="city-layout">
        <div className="city-map-wrap">
          <CityMap
            area={area}
            places={shown}
            selectedId={selectedId}
            onSelect={setSelectedId}
            walk={walk?.stops.map((s) => s.stop) ?? null}
          />
          <div className="city-groups" role="group" aria-label="Show places">
            <button className={`city-chip${group ? '' : ' active'}`} onClick={() => setGroup(null)}>
              All <span>{area.places.length}</span>
            </button>
            {PLACE_GROUPS.map((g) => {
              const count = area.places.filter((p) => groupOf(p.kind).id === g.id).length
              if (!count) return null
              return (
                <button
                  key={g.id}
                  className={`city-chip${group === g.id ? ' active' : ''}`}
                  onClick={() => setGroup(group === g.id ? null : g.id)}
                >
                  <span className="city-dot" style={{ background: g.colour }} />
                  {g.name} <span>{count}</span>
                </button>
              )
            })}
          </div>
        </div>

        <aside className="city-side">
          {selected ? (
            <PlaceDetails place={selected} onBack={() => setSelectedId(null)} />
          ) : (
            <>
              <div className="city-area-head">
                <h4>{area.name}</h4>
                <span className="city-progress" title="Places you've visited here">
                  {areaVisited}/{area.places.length} visited
                </span>
              </div>
              <p className="city-blurb">{area.blurb}</p>
              <ul className="city-places">
                {shown.map((p) => (
                  <li key={p.id}>
                    <button className="city-place" onClick={() => setSelectedId(p.id)}>
                      <span className="city-dot" style={{ background: markerColour(p, !!passport[p.id]?.visited) }} />
                      <span className="city-place-text">
                        {p.name}
                        <span className="city-kind">
                          {KIND_NAMES[p.kind]} · {formatMinutes(p.visitMinutes)}
                          {p.hiddenGem && <span className="city-tag"> · hidden gem</span>}
                        </span>
                      </span>
                      <span className="city-stamps" aria-label="In your passport">
                        {passport[p.id]?.visited && <span title="Visited">✓</span>}
                        {passport[p.id]?.favourite && <span title="Favourite">★</span>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </aside>
      </div>

      <div className="city-cards">
        <section className="city-card">
          <h3>Plan a walk</h3>
          <div className="segmented">
            {WALK_LENGTHS.map((m) => (
              <button
                key={m}
                className="button"
                aria-pressed={walkLength === m}
                onClick={() => setWalkLength(walkLength === m ? null : m)}
              >
                {formatMinutes(m)}
              </button>
            ))}
          </div>
          {walk ? (
            walk.stops.length ? (
              <ol className="city-walk">
                {walk.stops.map(({ stop, walk: minutes, arrive }) => (
                  <li key={stop.id}>
                    <button className="city-link" onClick={() => setSelectedId(stop.id)}>
                      {stop.name}
                    </button>
                    <span className="muted">
                      {minutes ? ` · ${minutes} min walk, about ${formatMinutes(arrive)} in` : ' · start here'}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="muted">Nothing left that fits in {formatMinutes(walkLength!)}: try a longer walk, or another area.</p>
            )
          ) : (
            <p className="muted">Pick how long you have, and the map draws a route through places you haven't been.</p>
          )}
          {walk && (
            <p className="city-fine">
              Estimates only, at an easy pace with an allowance for streets. Check opening times on each source page before you
              go.
            </p>
          )}
        </section>

        <section className="city-card">
          <h3>Discovery Passport</h3>
          <div
            className="city-meter"
            role="meter"
            aria-valuemin={0}
            aria-valuemax={ALL_PLACES.length}
            aria-valuenow={visitedCount}
          >
            <span style={{ width: `${(visitedCount / ALL_PLACES.length) * 100}%` }} />
          </div>
          <p>
            <strong>{visitedCount}</strong> of {ALL_PLACES.length} places visited
          </p>
          {favourites.length > 0 && <p className="muted">★ {favourites.map((p) => p.name).join(', ')}</p>}
          <p className="city-fine">Kept in this browser only.</p>
        </section>
      </div>

      <footer className="city-credit">
        Map data ©{' '}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
          OpenStreetMap
        </a>{' '}
        contributors. Place facts from each place's linked source.
      </footer>
    </Panel>
  )
}

function PlaceDetails({ place, onBack }: { place: Place; onBack: () => void }) {
  const entry = usePassport()[place.id] ?? {}
  const colour = groupOf(place.kind).colour
  return (
    <div className="city-details" style={{ '--place-colour': colour } as CSSProperties}>
      <button className="city-link" onClick={onBack}>
        ← All places
      </button>
      <p className="city-details-kind">
        <span className="city-dot" style={{ background: colour }} />
        {KIND_NAMES[place.kind]}
        {place.hiddenGem ? ' · hidden gem' : ''}
      </p>
      <h4>{place.name}</h4>
      <p className="muted">Allow about {formatMinutes(place.visitMinutes)}</p>
      <p>{place.description}</p>
      <div className="city-actions">
        <button
          className="city-toggle"
          aria-pressed={!!entry.visited}
          onClick={() => updatePassport(place.id, { visited: !entry.visited })}
        >
          ✓ {entry.visited ? 'Visited' : 'Mark visited'}
        </button>
        <button
          className="city-toggle"
          aria-pressed={!!entry.favourite}
          onClick={() => updatePassport(place.id, { favourite: !entry.favourite })}
        >
          ★ {entry.favourite ? 'Favourite' : 'Favourite it'}
        </button>
        <a className="city-toggle" href={place.source} target="_blank" rel="noreferrer">
          Source ↗
        </a>
      </div>
      <textarea
        className="city-note"
        placeholder="Your note: who you went with, what to see next time…"
        value={entry.note ?? ''}
        maxLength={500}
        onChange={(e) => updatePassport(place.id, { note: e.target.value })}
      />
    </div>
  )
}

/** The Leaflet map: OpenStreetMap tiles, a dot per place, and the planned walk as a line. */
function CityMap({
  area,
  places,
  selectedId,
  onSelect,
  walk,
}: {
  area: Neighbourhood
  places: Place[]
  selectedId: string | null
  onSelect: (id: string) => void
  walk: Place[] | null
}) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const layer = useRef<L.LayerGroup | null>(null)
  const passport = usePassport()
  const select = useRef(onSelect)
  select.current = onSelect

  useEffect(() => {
    const m = L.map(container.current!, { zoomControl: false, attributionControl: true })
    // Zoom buttons at the bottom right, clear of the filters along the top.
    L.control.zoom({ position: 'bottomright' }).addTo(m)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(m)
    layer.current = L.layerGroup().addTo(m)
    map.current = m
    return () => {
      m.remove()
      map.current = null
    }
  }, [])

  useEffect(() => {
    const m = map.current
    if (!m) return
    m.fitBounds(L.latLngBounds(area.places.map((p) => p.at)).pad(0.3), { maxZoom: 16 })
  }, [area])

  useEffect(() => {
    const group = layer.current
    if (!group) return
    group.clearLayers()
    if (walk && walk.length > 1) {
      L.polyline(
        walk.map((p) => p.at),
        { color: COLOURS.selected, weight: 3, dashArray: '6 6', opacity: 0.85 },
      ).addTo(group)
    }
    for (const place of places) {
      const selected = place.id === selectedId
      L.circleMarker(place.at, {
        radius: selected ? 7 : 5,
        color: selected ? COLOURS.selected : COLOURS.edge,
        weight: selected ? 2 : 1.5,
        fillColor: markerColour(place, !!passport[place.id]?.visited),
        fillOpacity: 0.95,
      })
        .bindTooltip(place.name, { className: 'city-tooltip', direction: 'top', offset: [0, -6] })
        .on('click', () => select.current(place.id))
        .addTo(group)
    }
  }, [places, selectedId, walk, passport])

  return <div ref={container} className="city-map" aria-label={`Map of ${area.name}`} />
}
