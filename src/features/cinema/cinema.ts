import { useSyncExternalStore } from 'react'
import { filmUrl, type Film } from './films.ts'

// Playback state for the home cinema, shared by the 3D screen and the film
// menu. There is a single <video> element, created when first needed; the
// theatre draws its frames onto the big screen.

export interface NowShowing {
  title: string
  /** Set for catalogue films, so the menu can link back to them. */
  filmId?: string
}

export interface CinemaState {
  nowShowing: NowShowing | null
  playing: boolean
  loading: boolean
  error: string | null
  volume: number
  watchlist: ReadonlySet<string>
}

const WATCHLIST_KEY = 'atlas.watchlist'
const VOLUME_KEY = 'atlas.cinemaVolume'

function load<T>(key: string, parse: (raw: string) => T, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw === null ? fallback : parse(raw)
  } catch {
    return fallback
  }
}

function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Storage can be unavailable (private windows); the setting just won't persist.
  }
}

let state: CinemaState = {
  nowShowing: null,
  playing: false,
  loading: false,
  error: null,
  volume: load(VOLUME_KEY, Number, 0.8),
  watchlist: new Set(load<string[]>(WATCHLIST_KEY, JSON.parse, [])),
}
const listeners = new Set<() => void>()

function set(partial: Partial<CinemaState>) {
  state = { ...state, ...partial }
  listeners.forEach((l) => l())
}

export function useCinema<T>(selector: (s: CinemaState) => T): T {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => selector(state),
  )
}

export const getCinema = () => state

let video: HTMLVideoElement | null = null
let objectUrl: string | null = null

/** The cinema's video element, created on first use. */
export function getVideo() {
  if (!video) {
    video = document.createElement('video')
    // Needed to draw frames from another site (Wikimedia Commons) into WebGL.
    video.crossOrigin = 'anonymous'
    video.playsInline = true
    video.preload = 'auto'
    video.volume = state.volume
    video.addEventListener('playing', () => set({ playing: true, loading: false, error: null }))
    video.addEventListener('pause', () => set({ playing: false }))
    video.addEventListener('waiting', () => set({ loading: true }))
    video.addEventListener('ended', () => set({ playing: false }))
    video.addEventListener('error', () => {
      if (!state.nowShowing) return
      set({
        playing: false,
        loading: false,
        error: 'This film could not be loaded. Check your connection, or open it on Wikimedia Commons instead.',
      })
    })
  }
  return video
}

function start(src: string, nowShowing: NowShowing) {
  const v = getVideo()
  if (objectUrl && objectUrl !== src) {
    URL.revokeObjectURL(objectUrl)
    objectUrl = null
  }
  set({ nowShowing, loading: true, error: null, playing: false })
  v.src = src
  v.currentTime = 0
  // play() needs a user gesture; it is always called from a click in the film menu.
  v.play().catch(() => undefined)
}

export function playFilm(film: Film) {
  start(filmUrl(film), { title: film.title, filmId: film.id })
}

/** Plays a video file from the visitor's own computer. It never leaves their machine. */
export function playFile(file: File) {
  const url = URL.createObjectURL(file)
  start(url, { title: file.name.replace(/\.[^.]+$/, '') })
  objectUrl = url
}

export function togglePlay() {
  const v = getVideo()
  if (!state.nowShowing) return
  if (v.paused) v.play().catch(() => undefined)
  else v.pause()
}

export function seekBy(seconds: number) {
  const v = getVideo()
  if (!state.nowShowing || !Number.isFinite(v.duration)) return
  v.currentTime = Math.max(0, Math.min(v.duration, v.currentTime + seconds))
}

/** Stops the film and clears the screen, e.g. when leaving the theatre. */
export function stopFilm() {
  if (!video) return
  video.pause()
  video.removeAttribute('src')
  video.load()
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl)
    objectUrl = null
  }
  set({ nowShowing: null, playing: false, loading: false, error: null })
}

export function setVolume(volume: number) {
  getVideo().volume = volume
  set({ volume })
  save(VOLUME_KEY, String(volume))
}

export function toggleWatchlist(filmId: string) {
  const next = new Set(state.watchlist)
  if (next.has(filmId)) next.delete(filmId)
  else next.add(filmId)
  set({ watchlist: next })
  save(WATCHLIST_KEY, JSON.stringify([...next]))
}
