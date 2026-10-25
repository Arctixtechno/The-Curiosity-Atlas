import { describe, expect, it } from 'vitest'
import { conversationModes } from './modes.ts'
import { placeholderModes, placeholderReply } from './placeholderCompanion.ts'

describe('placeholderReply', () => {
  it('has replies for every conversation mode', () => {
    expect(placeholderModes.sort()).toEqual(conversationModes.map((m) => m.id).sort())
  })

  it('quotes the visitor and moves on each turn', () => {
    const first = placeholderReply('socratic', [{ role: 'user', content: 'People are basically good.' }])
    expect(first).toContain('"People are basically good"')
    const second = placeholderReply('socratic', [
      { role: 'user', content: 'People are basically good.' },
      { role: 'assistant', content: first },
      { role: 'user', content: 'Because most people help strangers.' },
    ])
    expect(second).not.toBe(first)
  })

  it('shortens long messages', () => {
    const reply = placeholderReply('socratic', [{ role: 'user', content: 'word '.repeat(40) }])
    expect(reply).toContain('…"')
  })
})
