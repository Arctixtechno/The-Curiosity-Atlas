import { useEffect, useRef, useState } from 'react'
import { Panel } from '../../components/Panel.tsx'
import {
  CUP_LIMIT,
  DRINKS,
  differences,
  EMPTY_CUP,
  espressoMl,
  identify,
  POURS,
  SHOTS,
  totalMl,
  type Cup,
  type Drink,
  type ShotKind,
} from './drinks.ts'
import './CafePanel.css'

const W = 300
const H = 300

/** The cup the drink goes in, chosen by how much is in it: a demitasse, a cup, or a tall glass. */
function vessel(ml: number) {
  if (ml <= 70) return { capacity: 90, width: 110, height: 90, glass: false }
  if (ml <= 200) return { capacity: 200, width: 170, height: 140, glass: false }
  return { capacity: CUP_LIMIT, width: 130, height: 230, glass: true }
}

function mix(a: number[], b: number[], t: number) {
  return a.map((v, i) => Math.round(v + (b[i] - v) * t))
}

/** Espresso darkens a drink far more than its share of the volume. */
function liquidColour(espresso: number, milk: number, water: number) {
  const coffee = [52, 30, 16]
  const total = espresso + milk + water
  if (total === 0) return coffee
  const withMilk = mix(coffee, [234, 214, 184], Math.pow(milk / total, 1.6))
  return mix(withMilk, [92, 58, 34], water / total / 2)
}

function draw(
  ctx: CanvasRenderingContext2D,
  shown: { espresso: number; milk: number; foam: number; water: number },
  time: number,
) {
  ctx.clearRect(0, 0, W, H)
  const liquid = shown.espresso + shown.milk + shown.water
  const v = vessel(liquid + shown.foam)
  const base = H - 30
  const left = W / 2 - v.width / 2
  const top = base - v.height
  const taper = v.glass ? 8 : 14
  const perMl = v.height / v.capacity
  // Saucer, or the glass's shadow.
  ctx.fillStyle = v.glass ? 'rgba(0, 0, 0, 0.25)' : '#ece6da'
  ctx.beginPath()
  ctx.ellipse(W / 2, base + 6, v.width / 2 + (v.glass ? 6 : 40), v.glass ? 5 : 10, 0, 0, Math.PI * 2)
  ctx.fill()
  // The inside of the cup, tapering towards the foot.
  const inside = new Path2D()
  inside.moveTo(left, top)
  inside.lineTo(left + v.width, top)
  inside.lineTo(left + v.width - taper, base)
  inside.lineTo(left + taper, base)
  inside.closePath()
  ctx.save()
  ctx.clip(inside)
  ctx.fillStyle = v.glass ? 'rgba(220, 235, 245, 0.08)' : '#f6f1e8'
  ctx.fillRect(left, top, v.width, v.height)
  const [r, g, b] = liquidColour(shown.espresso, shown.milk, shown.water)
  const liquidTop = base - liquid * perMl
  ctx.fillStyle = `rgb(${r}, ${g}, ${b})`
  ctx.fillRect(left, liquidTop, v.width, base - liquidTop)
  // Crema on a black coffee: a thin golden band.
  if (shown.espresso > 0 && shown.milk + shown.foam < 1) {
    ctx.fillStyle = '#b07a3e'
    ctx.fillRect(left, liquidTop, v.width, Math.min(5, base - liquidTop))
  }
  // Foam sits on top, with soft bubbles.
  if (shown.foam > 0) {
    const foamTop = liquidTop - shown.foam * perMl
    const fg = ctx.createLinearGradient(0, foamTop, 0, liquidTop)
    fg.addColorStop(0, '#fbf6ec')
    fg.addColorStop(1, '#e6d6bc')
    ctx.fillStyle = fg
    ctx.fillRect(left, foamTop, v.width, liquidTop - foamTop + 1)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
    for (let i = 0; i < shown.foam / 2; i++) {
      const x = left + ((i * 37) % v.width)
      const y = foamTop + ((i * 53) % Math.max(1, liquidTop - foamTop))
      ctx.beginPath()
      ctx.arc(x, y, 1.5 + (i % 3), 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.restore()
  // The cup's outline and handle.
  ctx.strokeStyle = v.glass ? 'rgba(220, 235, 245, 0.7)' : '#f6f1e8'
  ctx.lineWidth = v.glass ? 2.5 : 6
  ctx.stroke(inside)
  if (!v.glass) {
    ctx.lineWidth = 9
    ctx.beginPath()
    ctx.ellipse(left + v.width - taper / 2 + 14, top + v.height * 0.4, 18, v.height * 0.2, 0, -Math.PI / 2, Math.PI / 2)
    ctx.stroke()
  }
  // A wisp of steam over anything with hot water or milk in it.
  if (shown.milk + shown.water + shown.espresso > 0) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)'
    ctx.lineWidth = 3
    for (const dx of [-18, 6, 26]) {
      ctx.beginPath()
      for (let y = 0; y < 50; y += 4) {
        const x = W / 2 + dx + Math.sin(y / 9 + time * 1.5 + dx) * 5
        if (y === 0) ctx.moveTo(x, top - 8 - y)
        else ctx.lineTo(x, top - 8 - y)
      }
      ctx.stroke()
    }
  }
}

/** The café counter: pull shots, steam milk and pour, and see which drink you've made. */
export function CafePanel() {
  const [cup, setCup] = useState<Cup>(EMPTY_CUP)
  const [order, setOrder] = useState<Drink | null>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const target = useRef({ espresso: 0, milk: 0, foam: 0, water: 0 })
  target.current = { espresso: espressoMl(cup), milk: cup.milk, foam: cup.foam, water: cup.water }

  useEffect(() => {
    const ctx = canvas.current!.getContext('2d')!
    const shown = { espresso: 0, milk: 0, foam: 0, water: 0 }
    let frame = 0
    const tick = (now: number) => {
      // Each part rises steadily towards its amount, like a pour.
      for (const k of ['espresso', 'milk', 'foam', 'water'] as const) {
        const d = target.current[k] - shown[k]
        shown[k] += Math.sign(d) * Math.min(Math.abs(d), 1.2)
      }
      draw(ctx, shown, now / 1000)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  const room = CUP_LIMIT - totalMl(cup)
  const add = (part: Partial<Cup>) => setCup((c) => ({ ...c, ...part }))
  const pull = (s: ShotKind) => add({ shots: [...cup.shots, s] })
  const made = identify(cup)
  const misses = order ? differences(cup, order) : []
  const nothing = totalMl(cup) === 0

  return (
    <Panel title="The café counter" wide>
      <div className="cafe-layout">
        <canvas ref={canvas} width={W} height={H} className="cafe-canvas" aria-label="Your cup, side on" />
        <div>
          <h3>Make a drink</h3>
          <div className="cafe-actions">
            {(Object.keys(SHOTS) as ShotKind[]).map((s) => (
              <button
                key={s}
                className="button"
                disabled={room < SHOTS[s].ml || cup.shots.length >= 3}
                onClick={() => pull(s)}
                title={SHOTS[s].note}
              >
                {SHOTS[s].name}
              </button>
            ))}
          </div>
          <div className="cafe-actions">
            <button className="button" disabled={room < POURS.milk} onClick={() => add({ milk: cup.milk + POURS.milk })}>
              Steamed milk +{POURS.milk} ml
            </button>
            <button className="button" disabled={room < POURS.foam} onClick={() => add({ foam: cup.foam + POURS.foam })}>
              Foam +{POURS.foam} ml
            </button>
            <button className="button" disabled={room < POURS.water} onClick={() => add({ water: cup.water + POURS.water })}>
              Hot water +{POURS.water} ml
            </button>
          </div>
          <dl className="cafe-readings">
            <dt>In the cup</dt>
            <dd>
              {nothing
                ? 'Nothing yet'
                : [
                    cup.shots.length && `${espressoMl(cup)} ml espresso`,
                    cup.milk && `${cup.milk} ml milk`,
                    cup.foam && `${cup.foam} ml foam`,
                    cup.water && `${cup.water} ml water`,
                  ]
                    .filter(Boolean)
                    .join(', ')}
            </dd>
            <dt>You've made</dt>
            <dd className={made ? 'cafe-made' : undefined}>
              {made
                ? `${/^[AEIOU]/.test(made.name) ? 'An' : 'A'} ${made.name.toLowerCase()}`
                : nothing
                  ? '…'
                  : 'Nothing on the menu yet'}
            </dd>
            {order && !nothing && (
              <>
                <dt>Your order</dt>
                <dd>{misses.length === 0 ? `Perfect ${order.name.toLowerCase()}` : misses.join('. ')}</dd>
              </>
            )}
          </dl>
          <button className="button" disabled={nothing} onClick={() => setCup(EMPTY_CUP)}>
            Tip it away and start again
          </button>
        </div>
      </div>
      <h3>The menu</h3>
      <p className="muted">Choose a drink to see how it's made, then try making it.</p>
      <div className="cafe-actions" role="radiogroup" aria-label="Order">
        {DRINKS.map((d) => (
          <button
            key={d.id}
            role="radio"
            aria-checked={order?.id === d.id}
            className={`button${order?.id === d.id ? ' button-active' : ''}`}
            onClick={() => {
              setOrder(order?.id === d.id ? null : d)
              setCup(EMPTY_CUP)
            }}
          >
            {d.name}
          </button>
        ))}
      </div>
      {order && (
        <p className="cafe-recipe">
          <strong>{order.name}:</strong> {order.recipe}{' '}
          <a href={order.source} target="_blank" rel="noreferrer">
            Source
          </a>
        </p>
      )}
      <p className="muted">
        Recipes follow the figures on Wikipedia's coffee pages, including the Italian Espresso National Institute's 7 g of coffee
        for 25 ml. Cafés vary, so each drink allows a little either way.
      </p>
    </Panel>
  )
}
