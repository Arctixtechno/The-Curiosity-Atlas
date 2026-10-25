import { useEffect, useRef, useState } from 'react'
import { Panel } from '../../components/Panel.tsx'
import { library } from '../../services/library.ts'
import { chooseMode, retry, sendMessage, useConversation } from './conversation.ts'
import { conversationModes } from './modes.ts'
import '../FeaturePanels.css'

/** The Philosophy Lounge conversation: pick a mode, then talk (spec section 5.2). */
export function LoungePanel() {
  const { modeId, messages, pending, error } = useConversation()
  const mode = conversationModes.find((m) => m.id === modeId) ?? conversationModes[0]
  const [draft, setDraft] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'end' })
  }, [messages.length, pending, error])

  const send = (text: string) => {
    sendMessage(text)
    setDraft('')
  }

  return (
    <Panel title="Philosophy Lounge">
      <div className="feature-panel">
        <label className="mode-picker">
          <span className="visually-hidden">Conversation mode</span>
          <select value={modeId} onChange={(e) => chooseMode(e.target.value)} disabled={pending}>
            {conversationModes.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <p className="muted">{mode.description}</p>

        <div className="chat-log" aria-live="polite">
          {messages.length === 0 && (
            <div className="starters">
              {mode.starters.map((s) => (
                <button key={s} onClick={() => send(s)}>
                  {s}
                </button>
              ))}
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`chat-message ${m.role}`}>
              <p>{m.content}</p>
              {m.role === 'assistant' && (
                <SaveInsight text={m.content} modeName={mode.name} question={messages[i - 1]?.content} />
              )}
            </div>
          ))}
          {pending && <div className="chat-message assistant thinking">Thinking…</div>}
          {error && (
            <div className="chat-error" role="alert">
              {error}{' '}
              <button className="link" onClick={retry}>
                Try again
              </button>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <form
          className="chat-input"
          onSubmit={(e) => {
            e.preventDefault()
            send(draft)
          }}
        >
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send(draft)
              }
            }}
            placeholder="Say what you think…"
            rows={2}
            aria-label="Your message"
            autoFocus
          />
          <button className="primary" type="submit" disabled={pending || !draft.trim()}>
            Send
          </button>
        </form>
      </div>
    </Panel>
  )
}

function SaveInsight({ text, modeName, question }: { text: string; modeName: string; question?: string }) {
  const [saved, setSaved] = useState(false)
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
  return (
    <button className="link save-insight" onClick={save} disabled={saved}>
      {saved ? '✓ Saved to Library' : 'Save this insight'}
    </button>
  )
}
