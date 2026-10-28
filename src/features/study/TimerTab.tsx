import { useState } from 'react'
import { dayKey, useSaved } from './saved.ts'
import {
  ambience,
  ambienceVolume,
  choose,
  pauseTimer,
  playAmbience,
  resetTimer,
  setFocusLabel,
  skipPhase,
  startTimer,
  updateTimerSettings,
  useFocusLog,
  useTimer,
  useTimerSettings,
} from './focus.ts'
import { AMBIENCES } from './sound.ts'
import { formatClock, formatMinutes, PHASE_NAMES, phaseLength, timeLeft, type Phase } from './timer.ts'
import { useNow } from './useNow.ts'

const RING = 2 * Math.PI * 88

/** The last seven days of focus, oldest first. */
function useWeek() {
  const log = useFocusLog()
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date()
    day.setDate(day.getDate() - (6 - i))
    const key = dayKey(day)
    return { key, label: day.toLocaleDateString(undefined, { weekday: 'narrow' }), minutes: log[key]?.minutes ?? 0 }
  })
}

/** A number box that lets you clear it and type freely, keeping the last sensible value. */
function NumberSetting({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  const [text, setText] = useState(String(value))
  return (
    <label className="study-number">
      <span>{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          const v = Math.round(Number(e.target.value))
          if (e.target.value && v >= min && v <= max) onChange(v)
        }}
        onBlur={() => setText(String(value))}
      />
    </label>
  )
}

export function TimerTab() {
  const state = useTimer()
  const settings = useTimerSettings()
  const now = useNow(state.running)
  const left = timeLeft(state, now)
  const total = phaseLength(settings, state.phase)
  const progress = total > 0 ? 1 - left / total : 0
  const week = useWeek()
  const today = week[6].minutes
  const sessionsToday = useFocusLog()[dayKey()]?.sessions ?? 0
  const most = Math.max(60, ...week.map((d) => d.minutes))
  const sound = useSaved(ambience)
  const volume = useSaved(ambienceVolume)
  const inSet = (state.done % settings.longEvery) + (state.phase === 'focus' ? 1 : 0)

  const askToNotify = async (on: boolean) => {
    if (on && typeof Notification !== 'undefined' && Notification.permission === 'default') await Notification.requestPermission()
    updateTimerSettings({ notify: on && typeof Notification !== 'undefined' && Notification.permission === 'granted' })
  }

  return (
    <div className="study-timer">
      <div className="study-timer-main">
        <div className="segmented" role="group" aria-label="Session type">
          {(['focus', 'short', 'long'] as Phase[]).map((p) => (
            <button key={p} className="button" aria-pressed={state.phase === p} onClick={() => choose(p)}>
              {PHASE_NAMES[p]}
            </button>
          ))}
        </div>
        <div className={`study-ring study-ring-${state.phase}`}>
          <svg viewBox="0 0 200 200" aria-hidden="true">
            <circle className="study-ring-track" cx="100" cy="100" r="88" />
            <circle
              className="study-ring-fill"
              cx="100"
              cy="100"
              r="88"
              strokeDasharray={RING}
              strokeDashoffset={RING * (1 - progress)}
              transform="rotate(-90 100 100)"
            />
          </svg>
          <div className="study-ring-text">
            <span className="study-clock" role="timer" aria-live="off">
              {formatClock(left)}
            </span>
            <span className="muted">
              {state.phase === 'focus' ? `Session ${inSet} of ${settings.longEvery}` : PHASE_NAMES[state.phase]}
            </span>
          </div>
        </div>
        <input
          type="text"
          className="study-label"
          placeholder="What are you working on?"
          value={state.label}
          maxLength={120}
          onChange={(e) => setFocusLabel(e.target.value)}
        />
        <div className="study-controls">
          {state.running ? (
            <button className="button button-primary study-go" onClick={pauseTimer}>
              Pause
            </button>
          ) : (
            <button className="button button-primary study-go" onClick={startTimer}>
              {left < total ? 'Carry on' : 'Start'}
            </button>
          )}
          <button className="button button-quiet" onClick={resetTimer} disabled={left === total && !state.running}>
            Reset
          </button>
          <button className="button button-quiet" onClick={skipPhase} title="Move on without counting this one">
            Skip
          </button>
        </div>
        <p className="muted study-hint">The timer keeps going if you close this or walk to another room, and chimes when time is up.</p>
      </div>

      <div className="study-timer-side">
        <h3>Today</h3>
        <p className="study-today">
          <strong>{formatMinutes(today)}</strong> focused
          <span className="muted"> · {sessionsToday === 1 ? '1 session' : `${sessionsToday} sessions`}</span>
        </p>
        <div className="study-week" role="img" aria-label={`Minutes focused over the last week: ${week.map((d) => d.minutes).join(', ')}`}>
          {week.map((d, i) => (
            <div key={d.key} className="study-week-day">
              <div className="study-week-bar">
                <div className={i === 6 ? 'study-week-today' : ''} style={{ height: `${(d.minutes / most) * 100}%` }} />
              </div>
              <span>{d.label}</span>
            </div>
          ))}
        </div>

        <h3>Background sound</h3>
        <div className="segmented study-sounds" role="group" aria-label="Background sound">
          {AMBIENCES.map((a) => (
            <button key={a.id} className="button" aria-pressed={sound === a.id} onClick={() => playAmbience(a.id)}>
              {a.name}
            </button>
          ))}
        </div>
        <label className="study-volume">
          <span className="muted">Volume</span>
          <input
            type="range"
            min={0.02}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => playAmbience(sound, Number(e.target.value))}
            aria-label="Background sound volume"
          />
        </label>

        <details className="study-settings">
          <summary>Timer settings</summary>
          <div className="study-settings-grid">
            <NumberSetting label="Focus (min)" value={settings.focus} min={1} max={180} onChange={(focus) => updateTimerSettings({ focus })} />
            <NumberSetting label="Short break" value={settings.short} min={1} max={60} onChange={(short) => updateTimerSettings({ short })} />
            <NumberSetting label="Long break" value={settings.long} min={1} max={90} onChange={(long) => updateTimerSettings({ long })} />
            <NumberSetting
              label="Long break every"
              value={settings.longEvery}
              min={2}
              max={10}
              onChange={(longEvery) => updateTimerSettings({ longEvery })}
            />
          </div>
          <label className="study-check">
            <input type="checkbox" checked={settings.autoStart} onChange={(e) => updateTimerSettings({ autoStart: e.target.checked })} />
            Start the next session or break by itself
          </label>
          <label className="study-check">
            <input type="checkbox" checked={settings.notify} onChange={(e) => void askToNotify(e.target.checked)} />
            Notify me when time is up and the Atlas is in another tab
          </label>
        </details>
      </div>
    </div>
  )
}
