import { briefing } from './briefing.ts'
import { useMedals } from './LogbookPanel.tsx'
import { usePlant } from './plant.ts'
import { useSafety } from './safetyStore.ts'
import { useShifts } from './shiftStore.ts'
import './Briefing.css'

/**
 * The refinery as it stands, for when you're away from it: on the drive there and back, and on the house map.
 */
export default function RefineryBriefing({ title }: { title: string }) {
  const plant = usePlant((p) => p)
  const safety = useSafety((s) => s)
  const active = useShifts((s) => s.active)
  const best = useShifts((s) => s.best)
  const { list } = useMedals()
  const b = briefing(plant, safety, { active, best }, list)
  return (
    <section className="brief" aria-label={title}>
      <header>
        <small>{title}</small>
        <span className="brief-rank" title={b.rank.nextTitle ? `${b.rank.toNext} points to ${b.rank.nextTitle}` : 'The top rank'}>
          {b.rank.title} · {b.rank.points}/{b.rank.max}
        </span>
      </header>
      <p className="brief-headline">{b.headline}</p>
      <dl className="brief-facts">
        {b.facts.map((f) => (
          <div key={f.label} className={`brief-${f.tone}`}>
            <dt>{f.label}</dt>
            <dd>{f.value}</dd>
          </div>
        ))}
      </dl>
      {b.next.length > 0 && (
        <ol className="brief-next">
          {b.next.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ol>
      )}
    </section>
  )
}
