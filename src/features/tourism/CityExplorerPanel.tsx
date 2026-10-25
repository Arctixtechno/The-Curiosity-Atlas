import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Panel } from '../../components/Panel.tsx'
import { planWalk } from './geo.ts'
import { ALL_PLACES, NEIGHBOURHOODS, type Neighbourhood, type Place } from './places.ts'
import { updatePassport, usePassport } from './passport.ts'
import './CityExplorerPanel.css'

const WALK_LENGTHS = [60, 120, 180, 240]
const COLOURS = { place: '#e0a458', gem: '#7fc7a4', visited: '#9aa7b8', selected: '#fff4dc' }

function markerColour(place: Place, visited: boolean) {
  if (visited) return COLOURS.visited
  return place.hiddenGem ? COLOURS.gem : COLOURS.place
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
  const [area, setArea] = useState<Neighbourhood>(NEIGHBOURHOODS[0])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [walkLength, setWalkLength] = useState<number | null>(null)
  const passport = usePassport()

  const selected = area.places.find((p) => p.id === selectedId) ?? null
  const walk = useMemo(
    () =>
      walkLength
        ? planWalk(
            area.places.filter((p) => !passport[p.id]?.visited),
            area.centre,
            walkLength,
          )
        : null,
    [area, walkLength, passport],
  )

  const visitedCount = ALL_PLACES.filter((p) => passport[p.id]?.visited).length
  const favourites = ALL_PLACES.filter((p) => passport[p.id]?.favourite)

  const chooseArea = (n: Neighbourhood) => {
    setArea(n)
    setSelectedId(null)
    setWalkLength(null)
  }

  return (
    <Panel title="City Explorer · London" wide>
      <div className="city-areas" role="tablist" aria-label="Neighbourhoods">
        {NEIGHBOURHOODS.map((n) => (
          <button
            key={n.id}
            role="tab"
            aria-selected={n.id === area.id}
            className={`button${n.id === area.id ? ' button-active' : ''}`}
            onClick={() => chooseArea(n)}
          >
            {n.name}
          </button>
        ))}
      </div>

      <div className="city-layout">
        <CityMap area={area} selectedId={selectedId} onSelect={setSelectedId} walk={walk?.stops.map((s) => s.stop) ?? null} />

        <div className="city-side">
          {selected ? (
            <PlaceDetails place={selected} onBack={() => setSelectedId(null)} />
          ) : (
            <>
              <p>{area.blurb}</p>
              <ul className="city-places">
                {area.places.map((p) => (
                  <li key={p.id}>
                    <button className="city-place" onClick={() => setSelectedId(p.id)}>
                      <span className="city-dot" style={{ background: markerColour(p, !!passport[p.id]?.visited) }} />
                      <span>
                        {p.name}
                        {p.hiddenGem && <span className="city-tag">hidden gem</span>}
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
        </div>
      </div>

      <h3>Plan a walk</h3>
      <div className="segmented">
        {WALK_LENGTHS.map((m) => (
          <button
            key={m}
            className={`button${walkLength === m ? ' button-active' : ''}`}
            onClick={() => setWalkLength(walkLength === m ? null : m)}
          >
            {formatMinutes(m)}
          </button>
        ))}
      </div>
      {walk && (
        <>
          {walk.stops.length ? (
            <ol className="city-walk">
              {walk.stops.map(({ stop, walk: minutes, arrive }) => (
                <li key={stop.id}>
                  <button className="city-link" onClick={() => setSelectedId(stop.id)}>
                    {stop.name}
                  </button>
                  <span className="muted">
                    {minutes ? ` · about ${minutes} min walk, arriving around ${formatMinutes(arrive)} in; ` : ' · start here; '}
                    allow about {formatMinutes(stop.visitMinutes)}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="muted">Nothing left that fits in {formatMinutes(walkLength!)}: try a longer walk, or another area.</p>
          )}
          <p className="muted">
            Estimates only: walking times use straight-line distance with an allowance for streets, at an easy pace. Places you've
            marked visited are skipped. Check opening times on each source page before you go.
          </p>
        </>
      )}

      <h3>Discovery Passport</h3>
      <p>
        {visitedCount} of {ALL_PLACES.length} places visited
        {favourites.length ? ` · favourites: ${favourites.map((p) => p.name).join(', ')}` : ''}
      </p>
      <p className="muted">Your passport is kept in this browser only.</p>

      <p className="muted city-credit">
        Map data ©{' '}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
          OpenStreetMap
        </a>{' '}
        contributors. Place facts from each place's linked source.
      </p>
    </Panel>
  )
}

function PlaceDetails({ place, onBack }: { place: Place; onBack: () => void }) {
  const entry = usePassport()[place.id] ?? {}
  return (
    <div className="city-details">
      <button className="city-link" onClick={onBack}>
        ← All places
      </button>
      <h4>{place.name}</h4>
      <p className="muted">
        {place.kind}
        {place.hiddenGem ? ' · hidden gem' : ''} · allow about {formatMinutes(place.visitMinutes)}
      </p>
      <p>{place.description}</p>
      <p>
        <a href={place.source} target="_blank" rel="noreferrer">
          Read more at the source
        </a>
      </p>
      <label className="setting-check">
        <input
          type="checkbox"
          checked={!!entry.visited}
          onChange={(e) => updatePassport(place.id, { visited: e.target.checked })}
        />
        Visited
      </label>
      <label className="setting-check">
        <input
          type="checkbox"
          checked={!!entry.favourite}
          onChange={(e) => updatePassport(place.id, { favourite: e.target.checked })}
        />
        Favourite
      </label>
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
  selectedId,
  onSelect,
  walk,
}: {
  area: Neighbourhood
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
    const m = L.map(container.current!, { zoomControl: true, attributionControl: true })
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
    for (const place of area.places) {
      const selected = place.id === selectedId
      L.circleMarker(place.at, {
        radius: selected ? 10 : 7,
        color: selected ? COLOURS.selected : '#2a1d12',
        weight: 2,
        fillColor: markerColour(place, !!passport[place.id]?.visited),
        fillOpacity: 0.95,
      })
        .bindTooltip(place.name)
        .on('click', () => select.current(place.id))
        .addTo(group)
    }
  }, [area, selectedId, walk, passport])

  return <div ref={container} className="city-map" aria-label={`Map of ${area.name}`} />
}
