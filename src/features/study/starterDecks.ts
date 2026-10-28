import type { Deck } from './flashcards.ts'

// Two small decks to start with, so the card box isn't empty on the first
// visit: how to study well, and the basics of an oil refinery.

const deck = (id: string, name: string, cards: [string, string][]): Deck => ({
  id,
  name,
  cards: cards.map(([front, back], i) => ({ id: `${id}-${i}`, front, back, box: 0, due: 0, reviews: 0 })),
})

export const STARTER_DECKS: Deck[] = [
  deck('study-skills', 'How to study well', [
    [
      'What is retrieval practice?',
      'Testing yourself by pulling an answer out of memory, rather than rereading it. Each recall makes the memory stronger.',
    ],
    [
      'What is the spacing effect?',
      'Study spread over several sessions is remembered better than the same time crammed into one sitting.',
    ],
    ['What is interleaving?', 'Mixing different kinds of problem in one session instead of practising one kind in a block.'],
    [
      'What is the Feynman technique?',
      'Explain the idea in plain words as if to a beginner. Where you get stuck or reach for jargon is what to study next.',
    ],
    [
      'What is the Pomodoro Technique?',
      'Working in focused blocks (traditionally 25 minutes) with short breaks between, and a longer break after four. Francesco Cirillo devised it in the late 1980s.',
    ],
    [
      'What is a Leitner box?',
      "A flashcard system by Sebastian Leitner: cards you get right move to a box you review less often, and cards you miss go back to the first box. It's how these cards are scheduled.",
    ],
  ]),
  deck('refinery', 'Refinery basics', [
    [
      'What does a crude distillation column separate crude oil by?',
      'Boiling point. Heated crude vapour rises up the column, and each fraction condenses on the trays at the height where it is cool enough.',
    ],
    [
      'Which fractions come off near the top of a crude column, and which near the bottom?',
      'Light ones (refinery gas, naphtha for petrol) near the top; heavy ones (gas oil, then residue) near the bottom.',
    ],
    [
      'Why is the heaviest residue distilled again under vacuum?',
      'Lower pressure lowers boiling points, so heavy oils can be separated without heating them so much that they crack.',
    ],
    [
      'What does a cracking unit (such as an FCC) do?',
      'Breaks long, heavy hydrocarbon molecules into shorter, more valuable ones such as petrol, using heat and a catalyst.',
    ],
    ['What is a heat exchanger for?', 'Passing heat from one stream to another without mixing them, such as hot products warming incoming crude.'],
    [
      'What does hydrotreating remove from fuels?',
      'Mostly sulphur (and some nitrogen), by reacting it with hydrogen over a catalyst, so the fuel burns cleaner.',
    ],
  ]),
]
