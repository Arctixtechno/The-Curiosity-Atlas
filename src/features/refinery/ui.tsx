import { useRef, type ReactNode } from 'react'
import { useCompleted } from './challenges.ts'

// Controls and formatting shared by the refinery's operator screens.

export function Slider({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
  digits = 0,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  unit: string
  onChange: (v: number) => void
  digits?: number
}) {
  return (
    <label className="cdu-control">
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <output>
        {value.toFixed(digits)} {unit}
      </output>
    </label>
  )
}

/** A dollar amount, in thousands or millions. */
export function money(dollars: number) {
  const sign = dollars < 0 ? '−' : ''
  const abs = Math.abs(dollars)
  return abs >= 1e6 ? `${sign}$${(abs / 1e6).toFixed(2)}m` : `${sign}$${Math.round(abs / 1000)}k`
}

/** A reading against its limit, like the bar graphs on a DCS overview. */
export function Gauge({
  label,
  value,
  min,
  max,
  limit,
  low,
  unit,
  digits = 0,
}: {
  label: string
  value: number
  min: number
  max: number
  limit: number
  low?: number
  unit: string
  digits?: number
}) {
  const at = (v: number) => `${Math.min(100, Math.max(0, ((v - min) / (max - min)) * 100))}%`
  const bad = value > limit || (low !== undefined && value < low)
  return (
    <div className={`cv-gauge${bad ? ' cv-gauge-bad' : ''}`}>
      <span>{label}</span>
      <div className="cv-gauge-bar">
        <div className="cv-gauge-fill" style={{ width: at(value) }} />
        <div className="cv-gauge-limit" style={{ left: at(limit) }} />
      </div>
      <output>
        {value.toFixed(digits)} {unit}
      </output>
    </div>
  )
}

export type ScreenTab = 'operate' | 'shift' | 'learn'

/** The Operate / Shift tasks / How it works switch every operator screen has. */
export function ScreenTabs({ tab, onChange, aside }: { tab: ScreenTab; onChange: (t: ScreenTab) => void; aside?: ReactNode }) {
  return (
    <div className="cdu-bar">
      <div className="segmented" role="tablist" aria-label="Screen">
        {(
          [
            ['operate', 'Operate'],
            ['shift', 'Shift tasks'],
            ['learn', 'How it works'],
          ] as const
        ).map(([id, label]) => (
          <button key={id} className="button" role="tab" aria-selected={tab === id} aria-pressed={tab === id} onClick={() => onChange(id)}>
            {label}
          </button>
        ))}
      </div>
      {aside}
    </div>
  )
}

export interface Task<P, R> {
  id: string
  title: string
  task: string
  hint: string
  met: (plant: P, result: R) => boolean
}

/** A screen's shift tasks: done ones ticked, the rest with a hint. */
export function TaskList<P, R>({ intro, tasks, plant, result }: { intro: string; tasks: Task<P, R>[]; plant: P; result: R }) {
  const completed = useCompleted()
  return (
    <div className="cdu-shift">
      <p>{intro}</p>
      <ol className="cdu-tasks">
        {tasks.map((t) => {
          const done = completed.has(t.id)
          return (
            <li key={t.id} className={done ? 'cdu-task-done' : ''}>
              <div className="cdu-task-head">
                <strong>{t.title}</strong>
                <span className={done ? 'cdu-good' : 'muted'}>{done ? 'Done' : t.met(plant, result) ? 'Met' : 'Not yet'}</span>
              </div>
              <p>{t.task}</p>
              {!done && (
                <details>
                  <summary>Hint</summary>
                  <p className="cdu-note">{t.hint}</p>
                </details>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

export function Warnings({ warnings, quiet, onReset, resetLabel }: { warnings: string[]; quiet: string; onReset: () => void; resetLabel: string }) {
  return (
    <>
      {warnings.length === 0 ? (
        <p className="muted">{quiet}</p>
      ) : (
        <ul className="cdu-alarms">
          {warnings.map((w) => (
            <li key={w} className="cdu-alarm-active cdu-alarm-low">
              {w}
            </li>
          ))}
        </ul>
      )}
      <button className="button button-quiet" onClick={onReset}>
        {resetLabel}
      </button>
    </>
  )
}

export interface Curve {
  points: [number, number][]
  colour: string
  name: string
  dashed?: boolean
}

/**
 * A small chart of one or more curves with a marker at the current setting. Click or drag on it to move the
 * setting along the x axis: the quickest way to explore where an optimum lies.
 */
export function CurveChart({
  x,
  y,
  curves,
  marker,
  lines = [],
  onPick,
  label,
}: {
  x: { min: number; max: number; label: string; step?: number }
  y: { min: number; max: number; label: string }
  curves: Curve[]
  marker?: { x: number; y: number }
  lines?: { x?: number; y?: number; label: string }[]
  onPick?: (x: number) => void
  label: string
}) {
  const w = 340
  const h = 170
  const pad = { l: 38, r: 10, t: 10, b: 28 }
  const sx = (v: number) => pad.l + ((v - x.min) / (x.max - x.min)) * (w - pad.l - pad.r)
  const sy = (v: number) => pad.t + (1 - (Math.min(y.max, Math.max(y.min, v)) - y.min) / (y.max - y.min)) * (h - pad.t - pad.b)
  const ref = useRef<SVGSVGElement>(null)
  const pick = (e: React.PointerEvent) => {
    if (!onPick || !ref.current) return
    const box = ref.current.getBoundingClientRect()
    const px = ((e.clientX - box.left) / box.width) * w
    const raw = x.min + ((px - pad.l) / (w - pad.l - pad.r)) * (x.max - x.min)
    const step = x.step ?? 1
    onPick(Math.min(x.max, Math.max(x.min, Math.round(raw / step) * step)))
  }
  const ticks = (min: number, max: number) => [min, (min + max) / 2, max]
  return (
    <div className="ui-curve">
      <svg
        ref={ref}
        className={`cdu-tbp${onPick ? ' ui-curve-pick' : ''}`}
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-label={label}
        onPointerDown={(e) => {
          ;(e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId)
          pick(e)
        }}
        onPointerMove={(e) => e.buttons && pick(e)}
      >
        <rect x={pad.l} y={pad.t} width={w - pad.l - pad.r} height={h - pad.t - pad.b} className="cdu-trend-bg" />
        {ticks(y.min, y.max).map((v) => (
          <text key={v} x={pad.l - 4} y={sy(v) + 3} textAnchor="end">
            {Number.isInteger(v) ? v : v.toFixed(1)}
          </text>
        ))}
        {ticks(x.min, x.max).map((v) => (
          <text key={v} x={sx(v)} y={h - 14} textAnchor="middle">
            {Number.isInteger(v) ? v : v.toFixed(1)}
          </text>
        ))}
        <text x={(pad.l + w - pad.r) / 2} y={h - 2} textAnchor="middle" className="ui-curve-axis">
          {x.label}
        </text>
        <text x={pad.l + 4} y={pad.t + 10} className="ui-curve-axis">
          {y.label}
        </text>
        {lines.map((l) =>
          l.x !== undefined ? (
            <g key={l.label}>
              <line x1={sx(l.x)} x2={sx(l.x)} y1={pad.t} y2={h - pad.b} className="rf-limit" />
              <text x={sx(l.x) + 3} y={pad.t + 22} className="ui-curve-line">
                {l.label}
              </text>
            </g>
          ) : (
            <g key={l.label}>
              <line x1={pad.l} x2={w - pad.r} y1={sy(l.y!)} y2={sy(l.y!)} className="rf-limit" />
              <text x={w - pad.r - 3} y={sy(l.y!) - 3} textAnchor="end" className="ui-curve-line">
                {l.label}
              </text>
            </g>
          ),
        )}
        {curves.map((c) => (
          <polyline
            key={c.name}
            points={c.points.map(([a, b]) => `${sx(a).toFixed(1)},${sy(b).toFixed(1)}`).join(' ')}
            style={{ stroke: c.colour, strokeDasharray: c.dashed ? '4 3' : undefined }}
          />
        ))}
        {marker && <circle cx={sx(marker.x)} cy={sy(marker.y)} r={5} className="ui-curve-marker" />}
      </svg>
      <ul className="cv-legend">
        {curves.map((c) => (
          <li key={c.name}>
            <span className="cdu-swatch" style={{ background: c.colour }} /> {c.name}
          </li>
        ))}
        {onPick && <li className="muted">Click or drag on the chart to move the setting</li>}
      </ul>
    </div>
  )
}
