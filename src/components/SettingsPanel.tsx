import { setVolume, useCinema } from '../features/cinema/cinema.ts'
import { FOV_RANGE, updateSettings, useSavingBattery, useSettings, type BatterySaver, type Quality } from '../world/settings.ts'
import { gameStore, saveSensitivity, useGame } from '../world/store.ts'
import { Panel } from './Panel.tsx'
import { GearIcon } from './icons.tsx'
import './SettingsPanel.css'

export const SETTINGS_OVERLAY = 'settings'

const QUALITY: { value: Quality; label: string; hint: string }[] = [
  { value: 'auto', label: 'Auto', hint: 'Sharp, lowering the resolution if frames drop' },
  { value: 'high', label: 'High', hint: 'Always sharp' },
  { value: 'low', label: 'Low', hint: 'Softer, for slower computers' },
]

const SAVER: { value: BatterySaver; label: string; hint: string }[] = [
  { value: 'auto', label: 'Auto', hint: 'Saves battery whenever your laptop is unplugged (where the browser can tell)' },
  { value: 'on', label: 'On', hint: 'Fewer pixels and at most 30 frames a second, for longer battery life' },
  { value: 'off', label: 'Off', hint: 'Full resolution and smoothness, even on battery' },
]

/** Player preferences: graphics, movement and sound, plus a reminder of the controls. */
export function SettingsPanel() {
  const quality = useSettings((s) => s.quality)
  const headBob = useSettings((s) => s.headBob)
  const soundVolume = useSettings((s) => s.soundVolume)
  const muted = useSettings((s) => s.muted)
  const fov = useSettings((s) => s.fov)
  const sensitivity = useGame((s) => s.mouseSensitivity)
  const volume = useCinema((s) => s.volume)
  const saver = useSettings((s) => s.batterySaver)
  const saving = useSavingBattery()

  return (
    <Panel title="Settings" subtitle="Graphics, battery, movement and sound" icon={<GearIcon />}>
      <h3>Graphics</h3>
      <div className="segmented" role="radiogroup" aria-label="Graphics quality">
        {QUALITY.map((q) => (
          <button
            key={q.value}
            className="button button-quiet"
            role="radio"
            aria-checked={quality === q.value}
            aria-pressed={quality === q.value}
            title={q.hint}
            onClick={() => updateSettings({ quality: q.value })}
          >
            {q.label}
          </button>
        ))}
      </div>
      <p className="muted">{QUALITY.find((q) => q.value === quality)?.hint}</p>

      <label className="setting">
        <span>Field of view</span>
        <input
          type="range"
          min={FOV_RANGE[0]}
          max={FOV_RANGE[1]}
          step={1}
          value={fov}
          onChange={(e) => updateSettings({ fov: Number(e.target.value) })}
        />
        <output>{fov}°</output>
      </label>

      <h3>Battery saver</h3>
      <div className="segmented" role="radiogroup" aria-label="Battery saver">
        {SAVER.map((q) => (
          <button
            key={q.value}
            className="button button-quiet"
            role="radio"
            aria-checked={saver === q.value}
            aria-pressed={saver === q.value}
            title={q.hint}
            onClick={() => updateSettings({ batterySaver: q.value })}
          >
            {q.label}
          </button>
        ))}
      </div>
      <p className="muted">
        {SAVER.find((q) => q.value === saver)?.hint}. {saving ? 'Saving battery now.' : 'Not saving battery now.'}
      </p>

      <h3>Movement</h3>
      <label className="setting">
        <span>Mouse sensitivity</span>
        <input
          type="range"
          min={0.4}
          max={6}
          step={0.1}
          value={sensitivity}
          onChange={(e) => {
            const value = Number(e.target.value)
            gameStore.set({ mouseSensitivity: value })
            saveSensitivity(value)
          }}
        />
        <output>{sensitivity.toFixed(1)}</output>
      </label>
      <label className="setting setting-check">
        <input type="checkbox" checked={headBob} onChange={(e) => updateSettings({ headBob: e.target.checked })} />
        <span>Head bob while walking</span>
      </label>

      <h3>Sound</h3>
      <label className="setting setting-check">
        <input type="checkbox" checked={!muted} onChange={(e) => updateSettings({ muted: !e.target.checked })} />
        <span>
          Room sounds and footsteps <span className="muted">(N turns them on and off)</span>
        </span>
      </label>
      <label className="setting">
        <span>Room sound volume</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={soundVolume}
          disabled={muted}
          onChange={(e) => updateSettings({ soundVolume: Number(e.target.value) })}
        />
        <output>{Math.round(soundVolume * 100)}%</output>
      </label>
      <label className="setting">
        <span>Film volume</span>
        <input type="range" min={0} max={1} step={0.05} value={volume} onChange={(e) => setVolume(Number(e.target.value))} />
        <output>{Math.round(volume * 100)}%</output>
      </label>

      <h3>Controls</h3>
      <dl className="keys">
        <dt>
          <kbd>W</kbd>
          <kbd>A</kbd>
          <kbd>S</kbd>
          <kbd>D</kbd>
        </dt>
        <dd>
          Move (hold <kbd>Shift</kbd> to walk faster)
        </dd>
        <dt>Mouse or arrow keys</dt>
        <dd>Look around</dd>
        <dt>
          <kbd>E</kbd>
        </dt>
        <dd>Open doors and use things</dd>
        <dt>
          <kbd>M</kbd>
        </dt>
        <dd>Map of the house</dd>
        <dt>
          <kbd>N</kbd>
        </dt>
        <dd>Sound on or off</dd>
        <dt>
          <kbd>H</kbd>
        </dt>
        <dd>Hide the interface, for clean screenshots</dd>
        <dt>
          <kbd>O</kbd>
        </dt>
        <dd>Settings</dd>
        <dt>
          <kbd>P</kbd> <kbd>,</kbd> <kbd>.</kbd>
        </dt>
        <dd>In the theatre: pause, skip back, skip forward</dd>
        <dt>
          <kbd>Q</kbd>
        </dt>
        <dd>Release the mouse</dd>
      </dl>
    </Panel>
  )
}
