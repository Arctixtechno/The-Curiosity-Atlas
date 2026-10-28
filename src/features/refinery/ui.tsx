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
