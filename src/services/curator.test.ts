import { describe, expect, it } from 'vitest'
import { askCurator, CuratorError } from './curator.ts'

const request = { feature: 'lounge' as const, mode: 'open', messages: [{ role: 'user' as const, content: 'Hello' }] }

const respond = (status: number, body: string, type = 'application/json') =>
  (async () => new Response(body, { status, headers: { 'content-type': type } })) as typeof fetch

async function kindOf(fetchImpl: typeof fetch) {
  try {
    await askCurator(request, fetchImpl)
    return 'ok'
  } catch (e) {
    return e instanceof CuratorError ? e.kind : 'other'
  }
}

describe('askCurator', () => {
  it('returns the reply', async () => {
    expect(await askCurator(request, respond(200, '{"reply":"Hi there"}'))).toBe('Hi there')
  })

  it('sends the conversation as JSON', async () => {
    let sent: unknown
    const capture = (async (_url: string, init: RequestInit) => {
      sent = JSON.parse(init.body as string)
      return new Response('{"reply":"ok"}', { headers: { 'content-type': 'application/json' } })
    }) as typeof fetch
    await askCurator(request, capture)
    expect(sent).toEqual(request)
  })

  it('explains each kind of failure', async () => {
    expect(await kindOf(respond(200, '<!doctype html>', 'text/html'))).toBe('not-connected')
    expect(await kindOf(respond(404, '{}'))).toBe('not-connected')
    expect(await kindOf(respond(429, '{}'))).toBe('busy')
    expect(await kindOf(respond(500, '{}'))).toBe('failed')
    expect(await kindOf(respond(200, '{"reply":""}'))).toBe('failed')
    expect(await kindOf((async () => Promise.reject(new TypeError('network'))) as typeof fetch)).toBe('offline')
  })
})
