import { useMemo, useState, type ReactNode } from 'react'
import { Panel } from '../../components/Panel.tsx'
import { openOverlay } from '../../world/overlay.ts'
import { certified, GLOSSARY, LESSONS, PASS_MARK, readings, searchGlossary, TOPICS, type Lesson, type Topic } from './academy.ts'
import { academy, takeAcademyTab, useAcademy, type AcademyState, type AcademyTab } from './academyStore.ts'
import { AcademyIcon, CatCrackerIcon, CokerIcon, ColumnFlameIcon, DcsIcon, ManagerIcon, ReformerIcon, SulphurIcon } from './icons.tsx'
import { getPlant } from './plant.ts'
import { clock } from './ui.tsx'
import './Refinery.css'

const LESSON_ICONS: Record<string, ReactNode> = {
  crude: <ColumnFlameIcon size={26} />,
  fcc: <CatCrackerIcon size={26} />,
  reformer: <ReformerIcon size={26} />,
  treating: <SulphurIcon size={26} />,
  control: <DcsIcon size={26} />,
  site: <ManagerIcon size={26} />,
  heavy: <CokerIcon size={26} />,
}

/** The training centre: guided lessons on the live plant, quizzes, a glossary, certificates and a notebook. */
export function AcademyPanel() {
  const [tab, setTab] = useState<AcademyTab>(takeAcademyTab)
  const state = useAcademy((s) => s)
  const certificates = LESSONS.filter((l) => certified(state, l)).length

  return (
    <Panel title="Training centre" subtitle="Learn the refinery on the live plant: lessons, quizzes, certificates and your notebook" icon={<AcademyIcon />} wide>
      <div className="cdu ac">
        <div className="cdu-bar">
          <div className="segmented" role="tablist" aria-label="Section">
            {(
              [
                ['lessons', 'Lessons'],
                ['quizzes', 'Quizzes'],
                ['glossary', 'Glossary'],
                ['certificates', 'Certificates'],
                ['notebook', 'Notebook'],
              ] as const
            ).map(([id, label]) => (
              <button key={id} className="button" role="tab" aria-selected={tab === id} aria-pressed={tab === id} onClick={() => setTab(id)}>
                {label}
              </button>
            ))}
          </div>
          <span className="ac-summary">
            <strong>{state.lessonsDone.length}</strong> of {LESSONS.length} lessons · <strong>{certificates}</strong> certificate{certificates === 1 ? '' : 's'}
          </span>
        </div>
        {tab === 'lessons' && <Lessons state={state} />}
        {tab === 'quizzes' && <Quizzes state={state} />}
        {tab === 'glossary' && <Glossary />}
        {tab === 'certificates' && <Certificates state={state} />}
        {tab === 'notebook' && <Notebook state={state} />}
      </div>
    </Panel>
  )
}

/** A ring that fills as a lesson's steps are done. */
function Ring({ done, total, children }: { done: number; total: number; children: ReactNode }) {
  const r = 22
  const c = 2 * Math.PI * r
  return (
    <span className="ac-ring">
      <svg viewBox="0 0 52 52" aria-hidden="true">
        <circle cx="26" cy="26" r={r} className="ac-ring-track" />
        <circle cx="26" cy="26" r={r} className="ac-ring-fill" strokeDasharray={`${(c * done) / total} ${c}`} transform="rotate(-90 26 26)" />
      </svg>
      <span className="ac-ring-icon">{children}</span>
    </span>
  )
}

function Lessons({ state }: { state: AcademyState }) {
  const [open, setOpen] = useState<string | null>(state.active)
  const start = (l: Lesson) => {
    academy.start(l.id)
    const step = l.steps[state.lessonsDone.includes(l.id) ? 0 : (state.steps[l.id] ?? 0)]
    // Straight to the screen the lesson starts on; the coach in the corner follows along.
    openOverlay(step?.open ?? l.steps[0].open ?? '')
  }
  return (
    <>
      <p className="cdu-note">
        Each lesson walks you through the real plant one step at a time. A coach sits in the corner of the screen and ticks each step off as the plant
        reaches it. Stuck? Press <em>Show me</em> and it does the step for you.
      </p>
      <ol className="ac-lessons">
        {LESSONS.map((l, i) => {
          const done = state.lessonsDone.includes(l.id)
          const step = done ? l.steps.length : Math.min(state.steps[l.id] ?? 0, l.steps.length)
          const active = state.active === l.id && !done
          const expanded = open === l.id
          return (
            <li key={l.id} className={`ac-lesson${done ? ' ac-lesson-done' : ''}${active ? ' ac-lesson-active' : ''}`}>
              <div className="ac-lesson-head">
                <Ring done={step} total={l.steps.length}>
                  {LESSON_ICONS[l.id]}
                </Ring>
                <div>
                  <small className="muted">Lesson {i + 1}</small>
                  <h3>{l.title}</h3>
                  <p>{l.summary}</p>
                </div>
              </div>
              <div className="ac-lesson-foot">
                <span className={done ? 'cdu-good' : 'muted'}>{done ? 'Done' : active ? `In progress: step ${step + 1} of ${l.steps.length}` : step > 0 ? `${step} of ${l.steps.length} steps` : `${l.steps.length} steps`}</span>
                <span className="ac-buttons">
                  <button className="button button-quiet" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : l.id)}>
                    {expanded ? 'Hide steps' : 'Steps'}
                  </button>
                  <button className={`button${done ? '' : ' button-primary'}`} onClick={() => start(l)}>
                    {done ? 'Do it again' : step > 0 ? 'Carry on' : 'Start'}
                  </button>
                </span>
              </div>
              {expanded && (
                <ol className="ac-steps">
                  {l.steps.map((s, j) => (
                    <li key={s.text} className={j < step ? 'ac-step-done' : j === step && active ? 'ac-step-now' : ''}>
                      <span>{s.text}</span>
                      {j < step && <small>{s.why}</small>}
                    </li>
                  ))}
                </ol>
              )}
            </li>
          )
        })}
      </ol>
    </>
  )
}

function Quizzes({ state }: { state: AcademyState }) {
  const [topic, setTopic] = useState<Topic | null>(null)
  if (topic) return <Quiz key={topic.id} topic={topic} onDone={() => setTopic(null)} />
  return (
    <>
      <p className="cdu-note">Five questions a topic. Four right is a pass, and a pass plus the lesson earns that topic’s certificate. Your best score is kept.</p>
      <ul className="ac-topics">
        {TOPICS.map((t) => {
          const best = state.quiz[t.id]
          const passed = (best ?? 0) >= PASS_MARK
          return (
            <li key={t.id}>
              <button className="ac-topic" onClick={() => setTopic(t)}>
                <strong>{t.title}</strong>
                <span className={passed ? 'cdu-good' : 'muted'}>{best === undefined ? 'Not taken' : `Best ${Math.round(best * 5)} of 5${passed ? ' · passed' : ''}`}</span>
                <span className="ac-pips" aria-hidden="true">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <i key={i} className={best !== undefined && i < Math.round(best * 5) ? 'on' : ''} />
                  ))}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </>
  )
}

function Quiz({ topic, onDone }: { topic: Topic; onDone: () => void }) {
  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const [right, setRight] = useState(0)
  const finished = index >= topic.questions.length
  const score = right / topic.questions.length

  if (finished)
    return (
      <div className="ac-quiz ac-result">
        <p className="ac-score">
          {right} <small>of {topic.questions.length}</small>
        </p>
        <h3>{score >= PASS_MARK ? 'Passed' : 'Not this time'}</h3>
        <p className="cdu-note">{score >= PASS_MARK ? 'Well done. If you’ve finished the lesson too, the certificate is yours.' : `You need ${Math.ceil(PASS_MARK * 5)} of 5. Read the explanations and try again.`}</p>
        <div className="ac-buttons">
          <button
            className="button"
            onClick={() => {
              setIndex(0)
              setRight(0)
              setPicked(null)
            }}
          >
            Try again
          </button>
          <button className="button button-primary" onClick={onDone}>
            Back to the quizzes
          </button>
        </div>
      </div>
    )

  const q = topic.questions[index]
  const answer = (i: number) => {
    if (picked !== null) return
    setPicked(i)
    const r = right + (i === q.answer ? 1 : 0)
    setRight(r)
    if (index === topic.questions.length - 1) academy.score(topic.id, r / topic.questions.length)
  }
  return (
    <div className="ac-quiz">
      <div className="ac-quiz-head">
        <button className="button button-quiet" onClick={onDone}>
          ← Quizzes
        </button>
        <strong>{topic.title}</strong>
        <span className="muted">
          Question {index + 1} of {topic.questions.length}
        </span>
      </div>
      <div className="ac-progress" aria-hidden="true">
        <i style={{ width: `${((index + (picked !== null ? 1 : 0)) / topic.questions.length) * 100}%` }} />
      </div>
      <h3 className="ac-question">{q.q}</h3>
      <div className="ac-options">
        {q.options.map((o, i) => (
          <button
            key={o}
            className={`button ac-option${picked === null ? '' : i === q.answer ? ' ac-right' : i === picked ? ' ac-wrong' : ' ac-faded'}`}
            onClick={() => answer(i)}
            disabled={picked !== null && i !== q.answer && i !== picked}
          >
            <span className="ac-letter">{'ABCD'[i]}</span>
            {o}
          </button>
        ))}
      </div>
      {picked !== null && (
        <div className={`ac-why ${picked === q.answer ? 'ac-why-right' : 'ac-why-wrong'}`} role="status">
          <strong>{picked === q.answer ? 'Right.' : 'Not quite.'}</strong> {q.why}
          <div>
            <button
              className="button button-primary"
              onClick={() => {
                setIndex(index + 1)
                setPicked(null)
              }}
            >
              {index === topic.questions.length - 1 ? 'See your score' : 'Next question'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Glossary() {
  const [query, setQuery] = useState('')
  const terms = useMemo(() => searchGlossary(query), [query])
  return (
    <div className="ac-glossary">
      <input className="ac-search" type="search" placeholder={`Search ${GLOSSARY.length} terms…`} value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search the glossary" />
      {terms.length === 0 && <p className="cdu-note">Nothing matches “{query}”.</p>}
      <dl>
        {terms.map((t) => (
          <div key={t.term}>
            <dt>{t.term}</dt>
            <dd>{t.meaning}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

const certificateDate = (d = new Date()) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

/** Opens a certificate on its own page and asks the browser to print it. */
function printCertificate(name: string, title: string, detail: string) {
  const w = window.open('', '_blank', 'width=900,height=650')
  if (!w) return
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c)
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>
    body{margin:0;display:grid;place-items:center;min-height:100vh;background:#f6efe2;font-family:Georgia,serif;color:#2a1d10}
    .c{width:780px;padding:56px 64px;border:10px double #b07a34;background:#fffaf0;text-align:center}
    small{letter-spacing:.25em;text-transform:uppercase;color:#8a6a3c}h1{font-size:44px;margin:10px 0 4px}h2{font-weight:normal;font-size:22px;margin:24px 0 6px}
    .n{font-size:34px;font-style:italic;border-bottom:1px solid #b07a34;display:inline-block;padding:0 24px 4px;margin:8px 0}p{font-size:16px;line-height:1.5}
    .f{display:flex;justify-content:space-between;margin-top:40px;font-size:14px;color:#6a5236}
  </style></head><body><div class="c"><small>Marshgate Refinery · Training centre</small><h1>Certificate</h1><h2>awarded to</h2>
  <div class="n">${esc(name || 'A curious engineer')}</div><p>for completing</p><h2><strong>${esc(title)}</strong></h2><p>${esc(detail)}</p>
  <div class="f"><span>${esc(certificateDate())}</span><span>The Curiosity Atlas</span></div></div>
  <script>window.onload=()=>window.print()</script></body></html>`)
  w.document.close()
}

function Certificates({ state }: { state: AcademyState }) {
  const all = LESSONS.every((l) => certified(state, l))
  return (
    <>
      <label className="ac-name">
        <span>Name on your certificates</span>
        <input type="text" value={state.name} placeholder="Your name" maxLength={60} onChange={(e) => academy.setName(e.target.value)} />
      </label>
      <div className="ac-certs">
        <Certificate
          master
          earned={all}
          name={state.name}
          title="Refinery engineer"
          detail="Every lesson and every quiz in the Marshgate training centre."
          needs={[`${LESSONS.filter((l) => certified(state, l)).length} of ${LESSONS.length} certificates`]}
        />
        {LESSONS.map((l) => {
          const topic = TOPICS.find((t) => t.id === l.topic)!
          const best = state.quiz[l.topic]
          return (
            <Certificate
              key={l.id}
              earned={certified(state, l)}
              name={state.name}
              title={l.title}
              detail={`The lesson “${l.title}”, and the quiz on ${topic.title.toLowerCase()} with ${Math.round((best ?? 0) * 5)} of 5.`}
              needs={[
                state.lessonsDone.includes(l.id) ? '✓ Lesson done' : '○ Finish the lesson',
                (best ?? 0) >= PASS_MARK ? '✓ Quiz passed' : `○ Pass the quiz on ${topic.title.toLowerCase()}`,
              ]}
            />
          )
        })}
      </div>
    </>
  )
}

function Certificate({ earned, name, title, detail, needs, master }: { earned: boolean; name: string; title: string; detail: string; needs: string[]; master?: boolean }) {
  return (
    <div className={`ac-cert${earned ? ' ac-cert-earned' : ''}${master ? ' ac-cert-master' : ''}`}>
      <span className="ac-seal" aria-hidden="true">
        <AcademyIcon size={master ? 28 : 20} />
      </span>
      <small>{master ? 'The full course' : 'Certificate'}</small>
      <strong>{title}</strong>
      {earned ? (
        <>
          <em>{name || 'A curious engineer'}</em>
          <button className="button" onClick={() => printCertificate(name, title, detail)}>
            Print
          </button>
        </>
      ) : (
        <ul>
          {needs.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Notebook({ state }: { state: AcademyState }) {
  const [note, setNote] = useState('')
  const save = (withReadings: boolean) => {
    const p = getPlant()
    academy.addNote({ at: Date.now(), simTime: p.furnace.time, note: note.trim(), readings: withReadings ? readings(p) : [] })
    setNote('')
  }
  const download = () => {
    const text = state.notebook
      .map((e) => [`${new Date(e.at).toLocaleString('en-GB')} (plant time ${clock(e.simTime)})`, e.note, ...e.readings.map((r) => `  ${r.label}: ${r.value}`)].filter(Boolean).join('\n'))
      .join('\n\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }))
    a.download = 'marshgate-notebook.txt'
    a.click()
    URL.revokeObjectURL(a.href)
  }
  return (
    <div className="ac-notebook">
      <div className="ac-compose">
        <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="What did you change, and what happened? An engineer writes it down." rows={3} aria-label="Note" />
        <div className="ac-buttons">
          <button className="button button-primary" onClick={() => save(true)}>
            Save with the plant’s readings
          </button>
          <button className="button" onClick={() => save(false)} disabled={!note.trim()}>
            Save note only
          </button>
          {state.notebook.length > 0 && (
            <button className="button button-quiet" onClick={download}>
              Download
            </button>
          )}
        </div>
      </div>
      {state.notebook.length === 0 && <p className="cdu-note">Nothing yet. Save a note to snapshot the furnace, the crackers, the sulphur and the margin as they stand now.</p>}
      <ol className="ac-entries">
        {state.notebook.map((e) => (
          <li key={e.id}>
            <div className="ac-entry-head">
              <strong>{new Date(e.at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</strong>
              <span className="muted">plant time {clock(e.simTime)}</span>
              <button className="button button-quiet" onClick={() => academy.deleteNote(e.id)} aria-label="Delete this note">
                Delete
              </button>
            </div>
            {e.note && <p>{e.note}</p>}
            {e.readings.length > 0 && (
              <dl className="ac-readings">
                {e.readings.map((r) => (
                  <div key={r.label}>
                    <dt>{r.label}</dt>
                    <dd>{r.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </li>
        ))}
      </ol>
    </div>
  )
}
