// Espresso drinks, from the figures on Wikipedia's coffee pages (each recipe
// links its page). Cafés vary, so each recipe is a range around those figures
// rather than one exact measure.

export type ShotKind = 'ristretto' | 'espresso' | 'lungo'

/** Volume in the cup for one shot of each kind, in millilitres. */
export const SHOTS: Record<ShotKind, { name: string; ml: number; note: string }> = {
  ristretto: { name: 'Ristretto shot', ml: 20, note: 'Same coffee, half the water' },
  espresso: { name: 'Espresso shot', ml: 30, note: '7 g of coffee, about 25 to 30 ml' },
  lungo: { name: 'Lungo shot', ml: 60, note: 'Same coffee, twice the water' },
}

/** How much each pour adds, in millilitres. */
export const POURS = { milk: 20, foam: 10, water: 30 }
/** The largest glass on the counter. */
export const CUP_LIMIT = 300

export interface Cup {
  shots: ShotKind[]
  /** Steamed milk, foam and hot water, in millilitres. */
  milk: number
  foam: number
  water: number
}

export const EMPTY_CUP: Cup = { shots: [], milk: 0, foam: 0, water: 0 }

export function espressoMl(cup: Cup) {
  return cup.shots.reduce((sum, s) => sum + SHOTS[s].ml, 0)
}

export function totalMl(cup: Cup) {
  return espressoMl(cup) + cup.milk + cup.foam + cup.water
}

type Range = [number, number]

export interface Drink {
  id: string
  name: string
  /** What goes in, in words, from the source. */
  recipe: string
  source: string
  /** The kind of shot, and how many. */
  shot: ShotKind
  shots: Range
  milk: Range
  foam: Range
  water: Range
  /** Any further rule, with what to say when it isn't met. */
  check?: (cup: Cup) => string | null
}

const NONE: Range = [0, 0]
const WIKI = 'https://en.wikipedia.org/wiki/'

export const DRINKS: Drink[] = [
  {
    id: 'espresso',
    name: 'Espresso',
    recipe: 'One shot: 7 g of coffee pulled at about 9 bar into 25 to 30 ml.',
    source: `${WIKI}Espresso`,
    shot: 'espresso',
    shots: [1, 1],
    milk: NONE,
    foam: NONE,
    water: NONE,
  },
  {
    id: 'doppio',
    name: 'Double espresso',
    recipe: 'Two shots from twice the coffee, about 14 g.',
    source: `${WIKI}Espresso`,
    shot: 'espresso',
    shots: [2, 2],
    milk: NONE,
    foam: NONE,
    water: NONE,
  },
  {
    id: 'ristretto',
    name: 'Ristretto',
    recipe: 'A short shot of about 20 ml: the same coffee as an espresso, pulled with half the water.',
    source: `${WIKI}Ristretto`,
    shot: 'ristretto',
    shots: [1, 2],
    milk: NONE,
    foam: NONE,
    water: NONE,
  },
  {
    id: 'lungo',
    name: 'Lungo',
    recipe: 'A long shot, pulled with about twice the water of an espresso, 50 to 70 ml.',
    source: `${WIKI}Lungo`,
    shot: 'lungo',
    shots: [1, 1],
    milk: NONE,
    foam: NONE,
    water: NONE,
  },
  {
    id: 'macchiato',
    name: 'Macchiato',
    recipe: 'An espresso "stained" with a spoonful of milk foam, 30 to 40 ml in all.',
    source: `${WIKI}Caff%C3%A8_macchiato`,
    shot: 'espresso',
    shots: [1, 1],
    milk: NONE,
    foam: [10, 10],
    water: NONE,
  },
  {
    id: 'cortado',
    name: 'Cortado',
    recipe: 'An espresso cut with one to two times as much warm steamed milk, and no foam.',
    source: `${WIKI}Cortado`,
    shot: 'espresso',
    shots: [1, 1],
    milk: [20, 60],
    foam: NONE,
    water: NONE,
  },
  {
    id: 'cappuccino',
    name: 'Cappuccino',
    recipe: 'One shot of espresso, with the rest of a 150 to 180 ml cup filled with equal parts steamed milk and foam.',
    source: `${WIKI}Cappuccino`,
    shot: 'espresso',
    shots: [1, 1],
    milk: [40, 100],
    foam: [40, 100],
    water: NONE,
    check: (cup) => {
      const total = totalMl(cup)
      if (total < 150) return 'A cappuccino fills a 150 to 180 ml cup'
      if (total > 190) return 'That is more than a cappuccino cup holds (150 to 180 ml)'
      if (Math.abs(cup.milk - cup.foam) > 30) return 'A cappuccino has about as much foam as milk'
      return null
    },
  },
  {
    id: 'flat-white',
    name: 'Flat white',
    recipe: 'A double espresso with about 130 ml of steamed milk and only a thin, 5 mm layer of microfoam.',
    source: `${WIKI}Flat_white`,
    shot: 'espresso',
    shots: [2, 2],
    milk: [100, 160],
    foam: [0, 10],
    water: NONE,
  },
  {
    id: 'latte',
    name: 'Caffè latte',
    recipe: 'Espresso with at least 210 ml of steamed milk, served in a glass, 250 to 280 ml in all, with little foam.',
    source: `${WIKI}Latte`,
    shot: 'espresso',
    shots: [1, 2],
    milk: [180, 260],
    foam: [0, 30],
    water: NONE,
    check: (cup) => (cup.milk + cup.foam < 210 ? 'A latte takes at least 210 ml of milk' : null),
  },
  {
    id: 'americano',
    name: 'Americano',
    recipe: 'Espresso topped up with hot water, about one part coffee to five of water.',
    source: `${WIKI}Caff%C3%A8_Americano`,
    shot: 'espresso',
    shots: [1, 2],
    milk: NONE,
    foam: NONE,
    water: [60, 300],
    check: (cup) => {
      const ratio = cup.water / espressoMl(cup)
      if (ratio < 3.5) return 'An Americano has about five times as much water as espresso'
      if (ratio > 6.5) return 'That is weaker than an Americano: about five parts water to one of espresso'
      return null
    },
  },
]

const within = (v: number, [min, max]: Range) => v >= min && v <= max

/** Everything about the cup that doesn't match the drink, in words. Empty when it matches. */
export function differences(cup: Cup, drink: Drink): string[] {
  const out: string[] = []
  const shotName = SHOTS[drink.shot].name.toLowerCase()
  if (cup.shots.some((s) => s !== drink.shot)) out.push(`It's made with a ${shotName}`)
  if (!within(cup.shots.length, drink.shots)) {
    const [a, b] = drink.shots
    out.push(a === b ? `It takes ${a === 1 ? 'one' : 'two'} ${shotName}${a > 1 ? 's' : ''}` : `It takes one or two ${shotName}s`)
  }
  const part = (label: string, value: number, range: Range) => {
    if (within(value, range)) return
    if (range[1] === 0) out.push(`No ${label}`)
    else if (value < range[0]) out.push(`More ${label}`)
    else out.push(`Less ${label}`)
  }
  part('steamed milk', cup.milk, drink.milk)
  part('foam', cup.foam, drink.foam)
  part('hot water', cup.water, drink.water)
  if (out.length === 0 && drink.check) {
    const note = drink.check(cup)
    if (note) out.push(note)
  }
  return out
}

/** The drink on the menu that the cup matches, if any. */
export function identify(cup: Cup): Drink | null {
  if (cup.shots.length === 0) return null
  return DRINKS.find((d) => differences(cup, d).length === 0) ?? null
}
