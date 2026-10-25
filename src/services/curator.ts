// Client for the Curator: the AI that explains discoveries and holds
// conversations (spec sections 5.2 and 9). Requests go to our own backend at
// /api/chat, never straight to an AI provider, so API keys stay on the server.

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatRequest {
  /** Which feature is asking, so the backend can pick the right instructions. */
  feature: 'lounge' | 'fountain'
  /** Conversation mode id, e.g. "socratic". */
  mode: string
  messages: ChatMessage[]
}

export type CuratorErrorKind = 'not-connected' | 'offline' | 'busy' | 'failed'

export class CuratorError extends Error {
  readonly kind: CuratorErrorKind
  constructor(kind: CuratorErrorKind, message: string) {
    super(message)
    this.kind = kind
  }
}

const ENDPOINT = '/api/chat'
const TIMEOUT_MS = 45_000

/** Friendly explanation for each failure, shown in the conversation. */
export const curatorErrorMessages: Record<CuratorErrorKind, string> = {
  'not-connected': "The Curator isn't connected yet, so there's no one to answer. This will work once the AI service is set up.",
  offline: "Couldn't reach the Curator. Check your internet connection and try again.",
  busy: 'The Curator is busy right now. Wait a moment and try again.',
  failed: 'Something went wrong while the Curator was replying. Try again.',
}

export async function askCurator(request: ChatRequest, fetchImpl: typeof fetch = fetch): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  let response: Response
  try {
    response = await fetchImpl(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: controller.signal,
    })
  } catch {
    throw new CuratorError('offline', curatorErrorMessages.offline)
  } finally {
    clearTimeout(timer)
  }

  // The dev server answers unknown paths with index.html, so anything that
  // isn't JSON means there is no backend yet.
  const isJson = response.headers.get('content-type')?.includes('application/json')
  if (response.status === 404 || !isJson) throw new CuratorError('not-connected', curatorErrorMessages['not-connected'])
  if (response.status === 429 || response.status === 503) throw new CuratorError('busy', curatorErrorMessages.busy)
  if (!response.ok) throw new CuratorError('failed', curatorErrorMessages.failed)

  const data = (await response.json().catch(() => null)) as { reply?: unknown } | null
  if (typeof data?.reply !== 'string' || !data.reply.trim()) throw new CuratorError('failed', curatorErrorMessages.failed)
  return data.reply
}
