import { useRef } from 'react'
import { Panel } from '../../components/Panel.tsx'
import { closeOverlay } from '../../world/overlay.ts'
import { playFile, playFilm, setVolume, stopFilm, togglePlay, toggleWatchlist, useCinema } from './cinema.ts'
import { FILMS, filmPage, type Film } from './films.ts'
import './CinemaPanel.css'

export const CINEMA_OVERLAY = 'cinema'

/** The theatre's film menu: what's showing, the catalogue, your watchlist and your own files. */
export function CinemaPanel() {
  const nowShowing = useCinema((s) => s.nowShowing)
  const playing = useCinema((s) => s.playing)
  const loading = useCinema((s) => s.loading)
  const error = useCinema((s) => s.error)
  const volume = useCinema((s) => s.volume)
  const watchlist = useCinema((s) => s.watchlist)
  const fileInput = useRef<HTMLInputElement>(null)
  const saved = FILMS.filter((f) => watchlist.has(f.id))

  const start = (film: Film) => {
    playFilm(film)
    closeOverlay()
  }

  return (
    <Panel title="The Theatre" wide>
      {nowShowing && (
        <div className="now-showing">
          <div>
            <div className="muted">{error ? 'Could not play' : loading ? 'Loading…' : playing ? 'Now showing' : 'Paused'}</div>
            <strong>{nowShowing.title}</strong>
            {error && <p className="cinema-error">{error}</p>}
          </div>
          <div className="now-showing-controls">
            {!error && (
              <button className="button" onClick={togglePlay}>
                {playing ? 'Pause' : 'Play'}
              </button>
            )}
            <button className="button button-quiet" onClick={stopFilm}>
              Stop
            </button>
            <label className="volume">
              Volume
              <input type="range" min={0} max={1} step={0.05} value={volume} onChange={(e) => setVolume(Number(e.target.value))} />
            </label>
          </div>
        </div>
      )}

      {saved.length > 0 && (
        <>
          <h3>Your watchlist</h3>
          <FilmList films={saved} onPlay={start} watchlist={watchlist} />
        </>
      )}

      <h3>Showing tonight</h3>
      <p className="muted">
        Public-domain films from Wikimedia Commons, streamed when you press play. In the theatre, <kbd>P</kbd> pauses and{' '}
        <kbd>,</kbd> <kbd>.</kbd> skip back and forward.
      </p>
      <FilmList films={FILMS} onPlay={start} watchlist={watchlist} />

      <h3>Your own film</h3>
      <p className="muted">Play a video file from your computer on the big screen. It stays on your computer.</p>
      <input
        ref={fileInput}
        type="file"
        accept="video/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) {
            playFile(file)
            closeOverlay()
          }
          e.target.value = ''
        }}
      />
      <button className="button" onClick={() => fileInput.current?.click()}>
        Choose a video file…
      </button>
    </Panel>
  )
}

function FilmList({ films, onPlay, watchlist }: { films: Film[]; onPlay: (f: Film) => void; watchlist: ReadonlySet<string> }) {
  return (
    <ul className="film-list">
      {films.map((film) => (
        <li key={film.id} className="film">
          <div className="film-text">
            <strong>{film.title}</strong>
            <span className="muted">
              {[film.by, film.year].filter(Boolean).join(', ')} ·{' '}
              <a href={filmPage(film)} target="_blank" rel="noreferrer">
                source
              </a>
            </span>
            <p>{film.description}</p>
          </div>
          <div className="film-actions">
            <button className="button" onClick={() => onPlay(film)}>
              Play
            </button>
            <button
              className="button button-quiet"
              aria-pressed={watchlist.has(film.id)}
              onClick={() => toggleWatchlist(film.id)}
              title={watchlist.has(film.id) ? 'Remove from your watchlist' : 'Save to your watchlist'}
            >
              {watchlist.has(film.id) ? '★ Saved' : '☆ Save'}
            </button>
          </div>
        </li>
      ))}
    </ul>
  )
}
