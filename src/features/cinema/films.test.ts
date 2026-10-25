import { describe, expect, it } from 'vitest'
import { FILMS, filmPage, filmUrl } from './films.ts'

describe('film catalogue', () => {
  it('has unique ids', () => {
    expect(new Set(FILMS.map((f) => f.id)).size).toBe(FILMS.length)
  })

  it('points every film at a WebM file on Wikimedia Commons', () => {
    for (const film of FILMS) {
      expect(film.commonsFile).toMatch(/\.webm$/)
      expect(filmUrl(film)).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/Special:FilePath\//)
      expect(filmPage(film)).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/)
    }
  })

  it('escapes characters that would break the URL', () => {
    const film = FILMS.find((f) => f.commonsFile.includes("'"))!
    expect(filmUrl(film)).not.toContain(' ')
    expect(decodeURIComponent(filmUrl(film).split('Special:FilePath/')[1])).toBe(film.commonsFile)
  })
})
