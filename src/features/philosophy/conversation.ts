import { useSyncExternalStore } from 'react'
import { askCurator, CuratorError, curatorErrorMessages, type ChatMessage } from '../../services/curator.ts'
import { placeholderReply } from './placeholderCompanion.ts'

// The current lounge conversation. It's kept in this browser, so standing up,
// leaving the house or closing the page doesn't lose it, until the visitor
// starts afresh.

/**
 * Until an AI Curator is set up, the companion answers with replies written
 * in advance. Set VITE_CURATOR=on (with a /api/chat backend) to use the AI.
 */
export const usesPlaceholderCompanion = import.meta.env.VITE_CURATOR !== 'on'
const PLACEHOLDER_DELAY_MS = 900

export interface Conversation {
  modeId: string
  messages: ChatMessage[]
  pending: boolean
  error: string | null
}

const STORAGE_KEY = 'atlas.loungeConversation'

function load(): Conversation {
  const fresh = { modeId: 'open', messages: [], pending: false, error: null }
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
    if (saved && typeof saved.modeId === 'string' && Array.isArray(saved.messages)) {
      const messages = saved.messages.filter(
        (m: ChatMessage) => (m?.role === 'user' || m?.role === 'assistant') && typeof m.content === 'string',
      )
      return { ...fresh, modeId: saved.modeId, messages }
    }
  } catch {
    // Unreadable or unavailable storage: start a fresh conversation.
  }
  return fresh
}

function save() {
  try {
    if (state.messages.length)
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ modeId: state.modeId, messages: state.messages }))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Storage can be unavailable (private windows); the conversation just won't outlast the page.
  }
}

let state: Conversation = load()
const listeners = new Set<() => void>()

function set(partial: Partial<Conversation>) {
  state = { ...state, ...partial }
  if ('messages' in partial || 'modeId' in partial) save()
  listeners.forEach((l) => l())
}

export function useConversation(): Conversation {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => {
        listeners.delete(l)
      }
    },
    () => state,
  )
}

/** Switching mode starts a fresh conversation. */
export function chooseMode(modeId: string) {
  if (state.pending) return
  set({ modeId, messages: [], error: null })
}

/** Clears the conversation (keeping the mode) to begin again. */
export function startFresh() {
  if (state.pending) return
  set({ messages: [], error: null })
}

async function requestReply(messages: ChatMessage[]) {
  set({ messages, pending: true, error: null })
  try {
    const reply = usesPlaceholderCompanion
      ? await new Promise<string>((resolve) =>
          setTimeout(() => resolve(placeholderReply(state.modeId, messages)), PLACEHOLDER_DELAY_MS),
        )
      : await askCurator({ feature: 'lounge', mode: state.modeId, messages })
    set({ messages: [...messages, { role: 'assistant', content: reply }], pending: false })
  } catch (e) {
    set({ pending: false, error: e instanceof CuratorError ? e.message : curatorErrorMessages.failed })
  }
}

export function sendMessage(text: string) {
  const content = text.trim()
  if (!content || state.pending) return
  void requestReply([...state.messages, { role: 'user', content }])
}

/** Asks again after a failed request, without repeating the visitor's message. */
export function retry() {
  if (!state.pending && state.messages.at(-1)?.role === 'user') void requestReply(state.messages)
}
