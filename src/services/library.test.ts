import { describe, expect, it } from 'vitest'
import { createLibrary, searchLibrary, type KeyValueStorage } from './library.ts'

function memoryStorage(initial: Record<string, string> = {}): KeyValueStorage & { data: Record<string, string> } {
  const data = { ...initial }
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) }
}

const item = (id: string, title: string, topic = 'Science') => ({
  id,
  kind: 'discovery' as const,
  title,
  topic,
  summary: `${title} summary`,
  body: ['Some explanation'],
})

describe('library', () => {
  it('saves newest first, ignores duplicates and persists', () => {
    const storage = memoryStorage()
    const lib = createLibrary(storage)
    lib.save(item('a', 'First'))
    lib.save(item('b', 'Second'))
    lib.save(item('a', 'First again'))
    expect(lib.all().map((i) => i.id)).toEqual(['b', 'a'])
    expect(createLibrary(storage).all().map((i) => i.title)).toEqual(['Second', 'First'])
  })

  it('removes items and notifies listeners', () => {
    const lib = createLibrary(memoryStorage())
    let calls = 0
    lib.subscribe(() => calls++)
    lib.save(item('a', 'First'))
    lib.remove('a')
    expect(lib.all()).toEqual([])
    expect(lib.has('a')).toBe(false)
    expect(calls).toBe(2)
  })

  it('survives corrupt or missing storage', () => {
    expect(createLibrary(memoryStorage({ 'atlas.library.v1': '{nope' })).all()).toEqual([])
    const lib = createLibrary(null)
    lib.save(item('a', 'First'))
    expect(lib.has('a')).toBe(true)
  })

  it('searches by words and subject', () => {
    const savedAt = '2026-10-24T12:00:00.000Z'
    const items = [{ ...item('a', 'Venus day', 'Science'), savedAt }, { ...item('b', 'Ship of Theseus', 'Philosophy'), savedAt }]
    expect(searchLibrary(items, 'venus').map((i) => i.id)).toEqual(['a'])
    expect(searchLibrary(items, 'ship theseus').map((i) => i.id)).toEqual(['b'])
    expect(searchLibrary(items, '', 'Philosophy').map((i) => i.id)).toEqual(['b'])
    expect(searchLibrary(items, 'summary')).toHaveLength(2)
  })
})
