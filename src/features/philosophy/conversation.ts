import { useSyncExternalStore } from 'react'
import { askCurator, CuratorError, curatorErrorMessages, type ChatMessage } from '../../services/curator.ts'
import { placeholderReply } from './placeholderCompanion.ts'

// The current lounge conversation, kept for the visit so leaving the chair and
// coming back doesn't lose it.

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

let state: Conversation = { modeId: 'open', messages: [], pending: false, error: null }
const listeners = new Set<() => void>()

function set(partial: Partial<Conversation>) {
  state = { ...state, ...partial }
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
