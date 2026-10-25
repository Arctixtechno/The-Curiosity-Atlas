import { describe, expect, it } from 'vitest'
import { DRINKS, differences, EMPTY_CUP, identify, POURS, totalMl, type Cup } from './drinks.ts'

const cup = (c: Partial<Cup>): Cup => ({ ...EMPTY_CUP, ...c })

/** A cup made the textbook way for each drink, using only whole pours. */
const TEXTBOOK: Record<string, Cup> = {
  espresso: cup({ shots: ['espresso'] }),
  doppio: cup({ shots: ['espresso', 'espresso'] }),
  ristretto: cup({ shots: ['ristretto'] }),
  lungo: cup({ shots: ['lungo'] }),
  macchiato: cup({ shots: ['espresso'], foam: 10 }),
  cortado: cup({ shots: ['espresso'], milk: 40 }),
  cappuccino: cup({ shots: ['espresso'], milk: 60, foam: 60 }),
  'flat-white': cup({ shots: ['espresso', 'espresso'], milk: 120, foam: 10 }),
  latte: cup({ shots: ['espresso'], milk: 220, foam: 20 }),
  americano: cup({ shots: ['espresso'], water: 150 }),
}

describe('café drinks', () => {
  it('recognise each textbook drink as itself, and as nothing else', () => {
    for (const drink of DRINKS) {
      const made = TEXTBOOK[drink.id]
      expect(made, drink.id).toBeDefined()
      expect(identify(made)?.id).toBe(drink.id)
      for (const other of DRINKS)
        if (other !== drink) expect(differences(made, other).length, `${drink.id} as ${other.id}`).toBeGreaterThan(0)
    }
  })

  it('make each textbook drink with whole pours', () => {
    for (const made of Object.values(TEXTBOOK)) {
      expect(made.milk % POURS.milk).toBe(0)
      expect(made.foam % POURS.foam).toBe(0)
      expect(made.water % POURS.water).toBe(0)
    }
  })

  it('come out at the volumes the sources give', () => {
    expect(totalMl(TEXTBOOK.cappuccino)).toBeGreaterThanOrEqual(150)
    expect(totalMl(TEXTBOOK.cappuccino)).toBeLessThanOrEqual(180)
    expect(totalMl(TEXTBOOK.macchiato)).toBeLessThanOrEqual(40)
    expect(totalMl(TEXTBOOK.latte)).toBeGreaterThanOrEqual(250)
    expect(totalMl(TEXTBOOK.americano)).toBe(180)
  })

  it('explain what is wrong with a near miss', () => {
    const flat = DRINKS.find((d) => d.id === 'flat-white')!
    expect(differences(cup({ shots: ['espresso', 'espresso'], milk: 120, foam: 60 }), flat)).toEqual(['Less foam'])
    const capp = DRINKS.find((d) => d.id === 'cappuccino')!
    expect(differences(cup({ shots: ['espresso'], milk: 100, foam: 40 }), capp)).toEqual([
      'A cappuccino has about as much foam as milk',
    ])
    expect(identify(EMPTY_CUP)).toBeNull()
  })
})
