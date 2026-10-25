import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { useModal } from '../../components/Panel.tsx'
import { BookmarkIcon, CheckIcon, ChevronIcon, CopyIcon, RefreshIcon, SendIcon, StandIcon } from '../../components/icons.tsx'
import { library } from '../../services/library.ts'
import { closeOverlay } from '../../world/overlay.ts'
import { prefersReducedMotion } from '../../world/settings.ts'
import { chooseMode, retry, sendMessage, startFresh, useConversation, usesPlaceholderCompanion } from './conversation.ts'
import { conversationModes, type ConversationMode } from './modes.ts'
import { useSeatAnchors } from './seatView.ts'
import './LoungePanel.css'

// The Philosophy Lounge conversation (spec section 5.2), shown once the
// visitor is sitting in the armchair. The 3D room stops drawing and rests
// behind it; firelight keeps flickering over it, the companion appears as a
// glowing presence above the other chair, and the conversation runs down
// the right-hand side.

/** What the companion is doing, which its presence shows. */
type Mood = 'listening' | 'attentive' | 'thinking' | 'speaking'

/** Ways to carry a conversation on after a reply. */
const FOLLOW_UPS = ['Say more about that', "What's the strongest objection?", 'Give me a concrete example', 'Ask me something']

const GREETING = 'Good evening. Pull your chair a little closer to the fire. What would you like to think about tonight?'

export function LoungePanel() {
  const { modeId, messages, pending, error } = useConversation()
  const mode = conversationModes.find((m) => m.id === modeId) ?? conversationModes[0]
  const anchors = useSeatAnchors()
  const [draft, setDraft] = useState('')
  const [choosing, setChoosing] = useState(false)
  // Replies that arrive while the panel is open are spoken word by word; earlier ones are already there.
  const [heardBefore] = useState(messages.length)
  const [speaking, setSpeaking] = useState(false)
  const column = useRef<HTMLElement>(null)
  const log = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLTextAreaElement>(null)

  useModal(column, () => (choosing ? setChoosing(false) : closeOverlay()))

  // Start with the cursor in the message box, once the column has slid in.
  useEffect(() => {
    const timer = setTimeout(() => input.current?.focus({ preventScroll: true }), prefersReducedMotion ? 0 : 380)
    return () => clearTimeout(timer)
  }, [])

  // Newer browsers return a promise from scrollTo, which an effect mustn't return, hence the braces.
  const scrollToEnd = () => {
    log.current?.scrollTo?.({ top: log.current.scrollHeight, behavior: 'smooth' })
  }
  useEffect(scrollToEnd, [messages.length, pending, error])

  const send = (text: string) => {
    if (!text.trim() || pending) return
    sendMessage(text)
    setDraft('')
    input.current?.focus()
  }

  const mood: Mood = pending ? 'thinking' : speaking ? 'speaking' : draft.trim() ? 'attentive' : 'listening'
  const last = messages.at(-1)
  const style = {
    '--companion-x': `${anchors.companion.x * 100}%`,
    '--companion-y': `${anchors.companion.y * 100}%`,
    '--fire-x': `${anchors.fire.x * 100}%`,
    '--fire-y': `${anchors.fire.y * 100}%`,
  } as CSSProperties

  return (
    <div className="lounge-scene" style={style} onClick={(e) => e.stopPropagation()}>
      <div className="lounge-firelight" aria-hidden="true" />
      <div className="lounge-shade" aria-hidden="true" />
      <Companion mood={mood} modeName={mode.name} />

      <section
        ref={column}
        className="lounge-column"
        role="dialog"
        aria-modal="true"
        aria-label="Philosophy Lounge"
        tabIndex={-1}
      >
        <header className="lounge-header">
          <div>
            <p className="lounge-place">Philosophy Lounge</p>
            <button
              className="lounge-mode"
              onClick={() => setChoosing((c) => !c)}
              aria-expanded={choosing}
              aria-controls="lounge-modes"
              disabled={pending}
            >
              <ModeGlyph id={mode.id} />
              {mode.name}
              <ChevronIcon size={14} />
            </button>
          </div>
          <div className="lounge-header-actions">
            {messages.length > 0 && (
              <button className="icon-button" onClick={startFresh} disabled={pending} title="Start a fresh conversation">
                <RefreshIcon />
                <span className="visually-hidden">Start a fresh conversation</span>
              </button>
            )}
            <button className="icon-button stand" onClick={closeOverlay} title="Stand up (Esc)">
              <StandIcon />
              <span>Stand up</span>
            </button>
          </div>
        </header>

        {choosing && (
          <ModeSheet
            current={mode.id}
            hasConversation={messages.length > 0}
            onChoose={(id) => {
              chooseMode(id)
              setChoosing(false)
              input.current?.focus()
            }}
          />
        )}

        <div className="lounge-log" ref={log} aria-live="polite">
          <Line role="assistant" text={GREETING} />
          {messages.length === 0 && (
            <div className="lounge-start">
              <p className="lounge-mode-note">{mode.description}</p>
              <div className="lounge-chips">
                {mode.starters.map((s) => (
                  <button key={s} className="chip" onClick={() => send(s)}>
                    {s}
                  </button>
                ))}
              </div>
              {usesPlaceholderCompanion && (
                <p className="lounge-small">
                  For now the companion answers with replies written in advance. A thinking AI comes later.
                </p>
              )}
            </div>
          )}
          {messages.map((m, i) => (
            <Line
              key={i}
              role={m.role}
              text={m.content}
              reveal={m.role === 'assistant' && i >= heardBefore}
              onSpeaking={setSpeaking}
              onGrow={scrollToEnd}
              question={messages[i - 1]?.content}
              modeName={mode.name}
            />
          ))}
          {pending && (
            <div className="lounge-thinking" role="status">
              <span className="dots" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              Considering that…
            </div>
          )}
          {error && (
            <div className="lounge-error" role="alert">
              <span>{error}</span>
              <button className="chip" onClick={retry}>
                Try again
              </button>
            </div>
          )}
          {last?.role === 'assistant' && !pending && !speaking && (
            <div className="lounge-chips follow-ups">
              {FOLLOW_UPS.map((s) => (
                <button key={s} className="chip" onClick={() => send(s)}>
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        <Composer draft={draft} setDraft={setDraft} send={send} pending={pending} input={input} />
      </section>
    </div>
  )
}

/** The companion: a warm, breathing light above the empty armchair, which listens, thinks and speaks. */
function Companion({ mood, modeName }: { mood: Mood; modeName: string }) {
  return (
    <div className={`companion companion-${mood}`} aria-hidden="true">
      <div className="companion-halo" />
      <div className="companion-ring companion-ring-a" />
      <div className="companion-ring companion-ring-b" />
      <div className="companion-core" />
      <div className="companion-sparks">
        {Array.from({ length: 7 }, (_, i) => (
          <i key={i} style={{ '--i': i } as CSSProperties} />
        ))}
      </div>
      <p className="companion-label">
        The Companion
        <span>{mood === 'thinking' ? 'thinking…' : mood === 'speaking' ? 'speaking' : modeName.toLowerCase()}</span>
      </p>
    </div>
  )
}

interface LineProps {
  role: 'user' | 'assistant'
  text: string
  reveal?: boolean
  onSpeaking?: (speaking: boolean) => void
  onGrow?: () => void
  question?: string
  modeName?: string
}

/** One turn of the conversation. A new reply from the companion appears word by word; click it to see it all. */
function Line({ role, text, reveal = false, onSpeaking, onGrow, question, modeName }: LineProps) {
  const words = text.split(/(\s+)/)
  const [shown, setShown] = useState(reveal && !prefersReducedMotion ? 0 : words.length)
  const done = shown >= words.length

  useEffect(() => {
    if (done) return
    onSpeaking?.(true)
    const word = words[shown - 2] ?? ''
    // A little pause after the end of a sentence or clause, as someone speaking would.
    const pause = /[.?!]["”’)]?$/.test(word) ? 260 : /[,;:—]$/.test(word) ? 120 : 0
    const timer = setTimeout(() => setShown((n) => n + 2), 64 + pause)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown, done])

  useEffect(() => {
    if (done && reveal) onSpeaking?.(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done])
  useEffect(() => () => onSpeaking?.(false), [onSpeaking])

  // Keep the newest words in view as they appear.
  useLayoutEffect(() => {
    if (reveal) onGrow?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown])

  if (role === 'user')
    return (
      <div className="line line-visitor">
        <p>{text}</p>
      </div>
    )

  return (
    <div className={`line line-companion${done ? '' : ' line-speaking'}`} onClick={() => setShown(words.length)}>
      <p>
        <span className="visually-hidden">{text}</span>
        <span aria-hidden="true">
          {words.slice(0, shown).join('')}
          {!done && <span className="caret" />}
        </span>
      </p>
      {done && modeName && <LineActions text={text} question={question} modeName={modeName} />}
    </div>
  )
}

function LineActions({ text, question, modeName }: { text: string; question?: string; modeName: string }) {
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)
  const save = () => {
    library.save({
      id: `insight:${Date.now()}`,
      kind: 'insight',
      title: question ?? 'An insight from the Philosophy Lounge',
      topic: 'Philosophy',
      summary: `From a ${modeName.toLowerCase()} in the Philosophy Lounge`,
      body: [text],
    })
    setSaved(true)
  }
  const copy = () => {
    void navigator.clipboard?.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    })
  }
  return (
    <div className="line-actions">
      <button onClick={save} disabled={saved} title={saved ? 'Saved to your Library' : 'Save this insight to your Library'}>
        <BookmarkIcon size={15} filled={saved} />
        <span>{saved ? 'Saved to Library' : 'Save insight'}</span>
      </button>
      <button onClick={copy} title="Copy this reply">
        {copied ? <CheckIcon size={15} /> : <CopyIcon size={15} />}
        <span>{copied ? 'Copied' : 'Copy'}</span>
      </button>
    </div>
  )
}

function ModeSheet({
  current,
  hasConversation,
  onChoose,
}: {
  current: string
  hasConversation: boolean
  onChoose: (id: string) => void
}) {
  return (
    <div className="mode-sheet" id="lounge-modes">
      <p className="lounge-small">
        What kind of conversation would you like?{hasConversation && ' Changing it starts a fresh one.'}
      </p>
      <div className="mode-cards" role="radiogroup" aria-label="Kind of conversation">
        {conversationModes.map((m: ConversationMode) => (
          <button key={m.id} className="mode-card" role="radio" aria-checked={m.id === current} onClick={() => onChoose(m.id)}>
            <ModeGlyph id={m.id} />
            <strong>{m.name}</strong>
            <span>{m.description}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

/** A small emblem for each kind of conversation. */
function ModeGlyph({ id }: { id: string }) {
  const paths: Record<string, string> = {
    open: 'M4 6h16v10H9l-5 4z',
    philosophical: 'M12 3l2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z',
    perspectives: 'M3 12a9 9 0 0 1 18 0M3 12a9 9 0 0 0 18 0M12 3v18',
    'thought-experiment': 'M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3',
    socratic: 'M9 9a3 3 0 1 1 4 2.8c-.7.3-1 1-1 1.7V15M12 18.5v.5',
    reflection: 'M12 3a6 6 0 0 0 0 12 6 6 0 0 1 0-12zM5 20h14',
  }
  return (
    <svg
      className="mode-glyph"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[id] ?? paths.open} />
    </svg>
  )
}

function Composer({
  draft,
  setDraft,
  send,
  pending,
  input,
}: {
  draft: string
  setDraft: (text: string) => void
  send: (text: string) => void
  pending: boolean
  input: React.RefObject<HTMLTextAreaElement | null>
}) {
  // The box grows with what's typed, up to a few lines, then scrolls.
  useLayoutEffect(() => {
    const box = input.current
    if (!box) return
    box.style.height = 'auto'
    box.style.height = `${Math.min(box.scrollHeight, 168)}px`
  }, [draft, input])

  return (
    <form
      className="lounge-composer"
      onSubmit={(e) => {
        e.preventDefault()
        send(draft)
      }}
    >
      <div className="composer-box">
        <textarea
          ref={input}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              send(draft)
            }
          }}
          placeholder="Say what you think…"
          rows={1}
          maxLength={2000}
          aria-label="Your message"
        />
        <button className="send" type="submit" disabled={pending || !draft.trim()} aria-label="Send">
          <SendIcon />
        </button>
      </div>
      <p className="composer-hint">
        <kbd>Enter</kbd> to send · <kbd>Shift</kbd>+<kbd>Enter</kbd> for a new line · <kbd>Esc</kbd> to stand up
      </p>
    </form>
  )
}
