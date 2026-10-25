// The museum's exhibits. Every fact here comes from the linked Wikipedia
// page; where the page gives no figure (an astrolabe's size, say), the label
// leaves it out rather than guessing.

import type { ExhibitId } from './overlayId.ts'

export type { ExhibitId }

export interface Exhibit {
  name: string
  /** Used in the prompt: "look closer at the …". */
  short: string
  date: string
  gallery: 'History' | 'Science' | 'Natural history' | 'Engineering'
  intro: string
  facts: [label: string, value: string][]
  /** Things to notice, turning the model over. */
  notice: string[]
  /** Where the real thing (or the best collection) can be seen. */
  seeIt?: string
  source: string
  /** The model is in code, so say how it differs from the real object. */
  modelNote: string
}

const WIKI = 'https://en.wikipedia.org/wiki/'

export const EXHIBITS: Record<ExhibitId, Exhibit> = {
  rosetta: {
    name: 'The Rosetta Stone',
    short: 'Rosetta Stone',
    date: 'Egypt, 196 BC',
    gallery: 'History',
    intro:
      'A fragment of a larger stele, inscribed with one decree in three scripts. It was the first Ancient Egyptian bilingual text recovered in modern times, and the key to reading hieroglyphs.',
    facts: [
      ['Material', 'Granodiorite, once mistaken for black basalt'],
      ['Size', '112.3 cm high at its highest point, 75.7 cm wide and 28.4 cm thick'],
      ['Weight', 'About 760 kg'],
      ['Found', 'July 1799, near Rosetta (Rashid) in the Nile Delta, by the French officer Pierre-François Bouchard'],
      ['Scripts', 'Hieroglyphs at the top, Demotic in the middle (32 lines) and Ancient Greek at the bottom (54 lines)'],
    ],
    notice: [
      'Only the last 14 lines of the hieroglyphic text survive: the top of the stone is broken away.',
      'The front is polished with the text lightly cut into it; the back is only roughly worked.',
      'The decree said a copy was to stand in every temple, in the language of the gods, of documents and of the Greeks.',
    ],
    seeIt: 'The British Museum in Bloomsbury, London, where it has been on show almost continuously since 1802.',
    source: `${WIKI}Rosetta_Stone`,
    modelNote: 'The model is to scale, but its inscriptions are stylised marks, not the real text.',
  },
  meteorite: {
    name: 'Gibeon meteorite',
    short: 'Gibeon meteorite',
    date: 'Fell in prehistoric times, Namibia',
    gallery: 'Natural history',
    intro:
      'An iron meteorite that fell over Great Namaqualand in Namibia. The Nama people found it first and made tools and weapons from it, including assegai heads.',
    facts: [
      ['Type', 'Iron, fine octahedrite (group IVA)'],
      ['Made of', 'About 91.8% iron, 7.7% nickel and 0.5% cobalt'],
      ['Total known', 'About 26,000 kg, in 100 to 150 pieces'],
      ['Strewn field', 'An ellipse 390 km long and 120 km wide, the second largest known'],
      ['Proved to be from space', 'In 1836, when John Herschel analysed samples sent to London'],
    ],
    notice: [
      'The cut face shows a Widmanstätten pattern: interleaved bands of the nickel-iron alloys kamacite and taenite.',
      'The bands only show once the iron is cut, polished and etched with acid, because taenite resists the acid better.',
      'Crystals this large grow only when metal cools extremely slowly, so the pattern cannot be made in a laboratory.',
    ],
    seeIt: '29 pieces stand on a fountain in Post Street Mall, Windhoek, a national monument since 1950.',
    source: `${WIKI}Gibeon_(meteorite)`,
    modelNote: "The model's shape and size are illustrative; the found pieces range from small fragments to over 500 kg.",
  },
  astrolabe: {
    name: 'Planispheric astrolabe',
    short: 'astrolabe',
    date: 'Earliest surviving, 927–928 AD',
    gallery: 'Science',
    intro:
      'An instrument that serves as a star chart and a model of the visible half of the sky. Its English name has been translated as "star-taker".',
    facts: [
      ['Material', 'Usually brass'],
      ['Earliest surviving', 'Dated AH 315 (927–928 AD)'],
      ['Uses', 'In the 10th century al-Sufi described over 1,000'],
      ['A famous guide', "Geoffrey Chaucer's Treatise on the Astrolabe, written for his son"],
    ],
    notice: [
      'The mater: a disc with a wide raised rim, deep enough to hold the plates (tympans) made for each latitude.',
      'The rete: an openwork frame with the ecliptic ring and pointers to the brightest stars. It turns over the plate as the sky turns.',
      'On the back, the alidade: a sighting rule for measuring the height of the sun or a star.',
    ],
    seeIt: 'Universal astrolabes can be seen at the History of Science Museum, Oxford.',
    source: `${WIKI}Astrolabe`,
    modelNote: 'The model is a typical example rather than one particular instrument.',
  },
  chronometer: {
    name: "Harrison's H4",
    short: 'chronometer',
    date: 'London, dated 1759',
    gallery: 'Engineering',
    intro:
      'John Harrison\'s first "sea watch", the marine chronometer that let a navigator find a ship\'s longitude at sea by keeping accurate time.',
    facts: [
      ['Maker', "John Harrison (1693–1776), a joiner and clockmaker, aided by some of London's finest workmen"],
      ['Case', 'Silver pair cases, some 13 cm in diameter'],
      ['Power', 'A coiled steel spring giving 30 hours'],
      ['Trial', 'Sailed from Portsmouth on 18 November 1761; at Kingston it was 5 seconds slow, about one nautical mile'],
    ],
    notice: [
      'It looks like an oversized pocket watch of its day, which is what Harrison intended.',
      'Inside, the pallets of its escapement are made of diamond.',
      'Captain Cook took K1, a copy of H4, on his second and third voyages.',
    ],
    seeIt: 'The Royal Observatory, Greenwich, with H1, H2 and H3. H4 is kept stopped, since running it would wear it.',
    source: `${WIKI}John_Harrison`,
    modelNote: 'The model shows the case and dial; the dial decoration is simplified.',
  },
  ammonite: {
    name: 'Ammonite',
    short: 'ammonite',
    date: 'About 410 to 66 million years ago',
    gallery: 'Natural history',
    intro:
      'An extinct cephalopod with a coiled shell. Over 10,000 species have been described, and the last vanished during or soon after the Cretaceous–Paleogene extinction, about 66 million years ago.',
    facts: [
      ['Shell', 'Usually a flat (planispiral) coil, divided into chambers'],
      ['Smallest', 'Maximites: adults only 10 mm across'],
      ['Largest', 'Parapuzosia seppenradensis, sometimes 2 m across'],
      ['Name', "From the shells' likeness to coiled rams' horns"],
    ],
    notice: [
      'The animal lived only in the last and largest chamber. The older ones behind it were closed off by thin walls called septa.',
      'A living tube, the siphuncle, ran back through the septa into the empty chambers.',
      'In medieval England they were thought to be coiled snakes turned to stone: "serpentstones".',
    ],
    source: `${WIKI}Ammonoidea`,
    modelNote: 'The model is a typical shell rather than a particular species.',
  },
  antikythera: {
    name: 'Antikythera mechanism',
    short: 'Antikythera mechanism',
    date: 'Greece, 2nd century BC',
    gallery: 'Engineering',
    intro:
      'An ancient Greek hand-powered model of the Solar System, the oldest known example of an analogue computer. Nothing as complex appears again until 14th-century Europe.',
    facts: [
      ['Found', '1901, in a Roman shipwreck 45 m down off the Greek island of Antikythera'],
      ['Size', 'A wooden case of about 34 × 18 × 9 cm (uncertain); now 82 fragments'],
      ['Gears', '35 meshing bronze gears, 30 still visible'],
      ['Largest gear', 'About 13 cm across, with 223 teeth'],
    ],
    notice: [
      'The big four-spoked wheel on the front of fragment A is gear b1, turned by a hand crank, now lost.',
      'The front dial showed the zodiac; the back had dials for the Metonic and Saros cycles.',
      'In May 1902 the archaeologist Valerios Stais noticed a gear wheel in one of the lumps of rock.',
    ],
    seeIt: 'The National Archaeological Museum in Athens, with reconstructions and replicas.',
    source: `${WIKI}Antikythera_mechanism`,
    modelNote: 'The model suggests fragment A and its great wheel; the corrosion and other gears are simplified.',
  },
}
