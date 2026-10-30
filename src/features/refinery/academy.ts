import { openOverlay } from '../../world/overlay.ts'
import { lightEndsResult } from './lightEndsPlant.ts'
import {
  CDU_OVERLAY,
  CONVERSION_OVERLAY,
  DCS_OVERLAY,
  HEAVY_END_OVERLAY,
  REFORMER_OVERLAY,
  SITE_OVERLAY,
  TREATING_OVERLAY,
} from './overlayIds.ts'
import { controls, treatingResult, type Plant, type TreatingResult } from './plant.ts'
import { siteBalance, type SiteBalance } from './site.ts'
import { money } from './ui.tsx'

// The training centre: guided lessons that watch the live plant, quizzes, a
// glossary and the readings for the engineer's notebook. Progress lives in
// academyStore.ts, which stays free of the plant so the HUD can load it cheaply.

/** What a lesson step can look at: the plant, the screen that's open, and the models' results (worked out on demand). */
export interface LessonContext {
  plant: Plant
  overlay: string | null
  readonly treating: TreatingResult
  readonly site: SiteBalance
}

export function lessonContext(plant: Plant, overlay: string | null): LessonContext {
  let treating: TreatingResult | undefined
  let site: SiteBalance | undefined
  return {
    plant,
    overlay,
    get treating() {
      return (treating ??= treatingResult(plant))
    },
    get site() {
      return (site ??= siteBalance(plant))
    },
  }
}

export interface LessonStep {
  /** What to do. */
  text: string
  /** What it shows, told once the step is done. */
  why: string
  /** The screen that has the control. */
  open?: string
  check: (c: LessonContext) => boolean
  /** Does the step for someone who wants to see it happen. */
  show?: () => void
}

export interface Lesson {
  id: string
  title: string
  summary: string
  /** The quiz that goes with it, and the certificate both earn. */
  topic: TopicId
  steps: LessonStep[]
}

const opened = (id: string, text: string, why: string): LessonStep => ({ text, why, open: id, check: (c) => c.overlay === id, show: () => openOverlay(id) })

/** Both blend pools on the planner's recipe. */
export function planBlend() {
  const r = lightEndsResult()
  for (const pool of ['petrol', 'diesel'] as const)
    controls.applyRecipe(pool, Object.fromEntries(r[pool].components.map((c, i) => [c.id, r[pool].best.volumes[i]])), true)
}

export const LESSONS: Lesson[] = [
  {
    id: 'crude',
    title: 'Inside the crude unit',
    summary: 'Heat the crude, split it by boiling range, and see what a different crude does to the cuts.',
    topic: 'crude',
    steps: [
      opened(CDU_OVERLAY, 'Open the crude unit’s screen.', 'Every barrel starts here. The furnace heats the crude and the column splits it by boiling point.'),
      {
        text: 'Raise the furnace outlet setpoint (TIC-101) to 365 °C.',
        why: 'A hotter flash zone lifts more of the crude into vapour, so more of it can be drawn as distillate instead of falling into the residue.',
        open: CDU_OVERLAY,
        check: (c) => c.plant.furnace.setpoint >= 365,
        show: () => controls.setSetpoint(365),
      },
      {
        text: 'Let the controller line the outlet out within half a degree of the new setpoint.',
        why: 'The PID controller opened the fuel valve, waited out the dead time and settled. Faster speeds on the clock make the wait shorter.',
        open: CDU_OVERLAY,
        check: (c) => c.plant.furnace.setpoint >= 365 && Math.abs(c.plant.furnace.outlet - c.plant.furnace.setpoint) < 0.5,
        show: () => controls.setSpeed(30),
      },
      {
        text: 'Draw at least 16% of the crude as kerosene, with every product on spec.',
        why: 'Kerosene grew at the expense of its neighbours. Jet sells for more than naphtha or diesel, as long as its flash point and end point hold.',
        open: CDU_OVERLAY,
        check: (c) => {
          const products = c.treating.conversion.cdu.products
          return products.kerosene.percent >= 16 && Object.values(products).every((p) => p.onSpec)
        },
        show: () => controls.setColumn({ keroDraw: 17 }),
      },
      {
        text: 'Switch the crude to Maya and look at the residue.',
        why: 'Maya is heavy and sour: far more of it boils above 565 °C, so the same column makes much more residue and less of everything else.',
        open: CDU_OVERLAY,
        check: (c) => c.plant.furnace.crude === 'maya',
        show: () => controls.setCrude('maya'),
      },
      {
        text: 'Put Brent back on.',
        why: 'The crude you buy decides most of what you can make. Crude choice is the biggest lever a refinery has.',
        open: CDU_OVERLAY,
        check: (c) => c.plant.furnace.crude === 'brent',
        show: () => controls.setCrude('brent'),
      },
    ],
  },
  {
    id: 'fcc',
    title: 'Cracking gas oil',
    summary: 'Turn heavy gas oil into petrol: the riser, the regenerator and the vacuum unit that feeds them.',
    topic: 'conversion',
    steps: [
      opened(CONVERSION_OVERLAY, 'Open the conversion screen.', 'The vacuum unit takes the crude unit’s residue and lifts gas oil out of it, and the cat cracker breaks that gas oil into petrol.'),
      {
        text: 'Raise the riser outlet temperature to 535 °C.',
        why: 'Hotter cracking converts more and raises the petrol’s octane, but it makes more gas and coke too: the gas compressor and the regenerator set the limit.',
        open: CONVERSION_OVERLAY,
        check: (c) => c.plant.fcc.rot >= 535,
        show: () => controls.setFcc({ rot: 535 }),
      },
      {
        text: 'Cut the vacuum unit deeper: furnace outlet 405 °C or more.',
        why: 'A deeper cut lifts more gas oil out of the residue, but the heavier gas oil brings carbon and metals that poison the cat cracker’s catalyst.',
        open: CONVERSION_OVERLAY,
        check: (c) => c.plant.vdu.cot >= 405,
        show: () => controls.setVdu({ cot: 410 }),
      },
      {
        text: 'Get the cat cracker’s conversion to 75% or more.',
        why: 'Conversion is the share of feed turned into petrol and lighter, plus coke. Every point of it is worth money, until the light ends overload the plant.',
        open: CONVERSION_OVERLAY,
        check: (c) => c.treating.conversion.fcc.conversion >= 75,
        show: () => controls.setFcc({ rot: 540 }),
      },
    ],
  },
  {
    id: 'reformer',
    title: 'Octane and hydrogen',
    summary: 'Reform naphtha into high-octane petrol, and see why the catalyst needs burning clean.',
    topic: 'reforming',
    steps: [
      opened(REFORMER_OVERLAY, 'Open the reformer’s screen.', 'The reformer turns low-octane naphtha into aromatics, and gives off the hydrogen the hydrotreaters live on.'),
      {
        text: 'Raise the reactor inlets until the reformate reaches 99 RON.',
        why: 'Hotter reactors drive more dehydrogenation and cyclisation: more octane and more hydrogen, but less reformate and faster coking.',
        open: REFORMER_OVERLAY,
        check: (c) => c.treating.reforming.reformer.octane >= 99,
        show: () => controls.setReformer({ wait: 515 }),
      },
      {
        text: 'Lower the separator pressure to 12 bar or less.',
        why: 'The reactions make hydrogen, so lower pressure pushes them further: more yield and more hydrogen, but coke builds faster on the catalyst.',
        open: REFORMER_OVERLAY,
        check: (c) => c.plant.reformer.pressure <= 12,
        show: () => controls.setReformer({ pressure: 12 }),
      },
      {
        text: 'Run the catalyst on for at least 30 days.',
        why: 'Coke has built up and the catalyst has lost activity. Operators raise the inlets to hold octane, until the metal limit ends the cycle.',
        open: REFORMER_OVERLAY,
        check: (c) => c.plant.catalyst.days >= 30,
        show: () => controls.runCatalyst(30),
      },
      {
        text: 'Regenerate the catalyst.',
        why: 'Burning the coke off restores the activity. A cyclic reformer does this one reactor at a time without stopping; a semi-regen shuts down for it.',
        open: REFORMER_OVERLAY,
        check: (c) => c.plant.catalyst.days === 0,
        show: () => controls.regenerate(),
      },
    ],
  },
  {
    id: 'treating',
    title: 'Taking the sulphur out',
    summary: 'Hydrotreat diesel to 10 ppm and turn the hydrogen sulphide into solid sulphur.',
    topic: 'treating',
    steps: [
      opened(TREATING_OVERLAY, 'Open the treating screen.', 'Hydrotreaters swap sulphur for hydrogen, making H₂S. The sulphur plant turns that H₂S into bright yellow sulphur.'),
      {
        text: 'Send the cat cracker’s light cycle oil to the diesel hydrotreater.',
        why: 'Light cycle oil is cheap diesel, but its sulphur sits in hindered molecules that are hard to reach, and it is short of hydrogen.',
        open: TREATING_OVERLAY,
        check: (c) => c.plant.dht.lco,
        show: () => controls.setDht({ lco: true }),
      },
      {
        text: 'Make diesel at 10 ppm sulphur or less with the light cycle oil in it.',
        why: 'A hotter reactor speeds up the desulphurisation. The catch is that it uses up the catalyst’s life and more hydrogen.',
        open: TREATING_OVERLAY,
        check: (c) => c.plant.dht.lco && c.treating.dht.onSpec,
        show: () => controls.setDht({ temp: 365 }),
      },
      {
        text: 'Get the sulphur plant to recover 99.5% or more.',
        why: 'Two Claus converters reach about 95%. A third converter and a tail gas unit take it past 99.5%, and the air must hold H₂S and SO₂ at two to one.',
        open: TREATING_OVERLAY,
        check: (c) => c.treating.sru.recovery >= 99.5,
        show: () => controls.setSru({ air: 100, converters: 3, tailGas: true }),
      },
    ],
  },
  {
    id: 'control',
    title: 'The control room',
    summary: 'Use the DCS: feed-forward, alarms and the advanced controller that pushes against the limits.',
    topic: 'control',
    steps: [
      opened(DCS_OVERLAY, 'Open the control room’s DCS.', 'The DCS shows every tag as it really moves: each one lags towards where the models say it will settle.'),
      {
        text: 'Turn on feed-forward from the crude rate to the furnace.',
        why: 'Feed-forward moves the fuel valve the moment the feed changes, instead of waiting for the outlet temperature to fall first.',
        open: DCS_OVERLAY,
        check: (c) => c.plant.feedForward,
        show: () => controls.setFeedForward(true),
      },
      {
        text: 'Raise the crude rate to 105 kb/d or more.',
        why: 'More crude needs more heat. With feed-forward the outlet barely moves; without it the controller would chase the dip.',
        open: DCS_OVERLAY,
        check: (c) => c.plant.furnace.feed >= 105,
        show: () => controls.setFeed(105),
      },
      {
        text: 'Acknowledge every alarm.',
        why: 'Acknowledging tells the system someone has seen it. It does not clear the cause, and a good alarm system asks for action on every alarm it raises.',
        open: DCS_OVERLAY,
        check: (c) => c.plant.dcsAlarms.every((a) => a.acked || !a.active),
        show: () => controls.ackAllAlarms(),
      },
      {
        text: 'Switch on the cat cracker’s advanced process control.',
        why: 'The APC pushes the feed up until a constraint binds, then holds it there: a few percent more throughput every hour of every day.',
        open: DCS_OVERLAY,
        check: (c) => c.plant.apc.fcc,
        show: () => controls.setApc({ fcc: true }),
      },
    ],
  },
  {
    id: 'site',
    title: 'Running the business',
    summary: 'Read the site’s margin, put the petrol on spec and run the tank farm for a week.',
    topic: 'business',
    steps: [
      opened(SITE_OVERLAY, 'Open the plant manager’s screen.', 'This is the whole refinery as a business: every barrel in, every product out, and what each one costs and earns.'),
      {
        text: 'Use the blending planner’s recipes for petrol and diesel.',
        why: 'Off-spec petrol can only be sold as cheap blendstock. The planner finds the cheapest mix of components that meets every spec.',
        open: SITE_OVERLAY,
        check: (c) => c.plant.blend.planned.petrol && c.plant.blend.planned.diesel,
        show: planBlend,
      },
      {
        text: 'Get the site’s margin above zero.',
        why: 'The margin is what the products sell for less the crude and the running costs. A few dollars a barrel is a good refinery.',
        open: SITE_OVERLAY,
        check: (c) => c.site.margin > 0,
        show: planBlend,
      },
      {
        text: 'Run the tank farm for at least a week.',
        why: 'Tanks fill and ships take the products away. Run out of room and you must slow the plant; run out of crude and it stops.',
        open: SITE_OVERLAY,
        check: (c) => c.plant.tanks.day >= 7,
        show: () => controls.runDays(7),
      },
    ],
  },
  {
    id: 'heavy',
    title: 'The bottom of the barrel',
    summary: 'Start the coker, the hydrocracker and the hydrogen plant, and turn residue into diesel.',
    topic: 'heavy',
    steps: [
      opened(HEAVY_END_OVERLAY, 'Open the heavy end’s screen.', 'Residue is the cheapest thing a refinery makes. These three units turn it into diesel, naphtha and coke.'),
      {
        text: 'Start the delayed coker.',
        why: 'The coker cracks residue so hard that what can’t be lifted as vapour is left as solid coke in the drum, which is cut out with water jets.',
        open: HEAVY_END_OVERLAY,
        check: (c) => c.plant.coker.running,
        show: () => controls.setCoker({ running: true }),
      },
      {
        text: 'Start the hydrocracker on 15 kb/d or more of gas oil.',
        why: 'The hydrocracker cracks gas oil under hydrogen. It makes the cleanest diesel and jet on the site, and uses a great deal of hydrogen doing it.',
        open: HEAVY_END_OVERLAY,
        check: (c) => c.plant.hydrocracker.running && c.plant.hydrocracker.feed >= 15,
        show: () => controls.setHydrocracker({ running: true, feed: 15 }),
      },
      {
        text: 'Make all the site’s hydrogen at home: none bought over the fence.',
        why: 'The steam methane reformer turns natural gas and steam into hydrogen. Bought hydrogen costs about $1,800 a tonne.',
        open: HEAVY_END_OVERLAY,
        check: (c) => c.plant.smr.running && c.treating.hydrogen.imported <= 0.01,
        show: () => controls.setSmr({ running: true }),
      },
    ],
  },
]

export type TopicId = 'crude' | 'conversion' | 'reforming' | 'treating' | 'control' | 'business' | 'heavy'

export interface Question {
  q: string
  options: string[]
  /** Index of the right option. */
  answer: number
  why: string
}

export interface Topic {
  id: TopicId
  title: string
  questions: Question[]
}

/** A lesson's certificate is earned by finishing the lesson and passing its quiz. */
export function certified(s: { lessonsDone: string[]; quiz: Record<string, number> }, lesson: Lesson) {
  return s.lessonsDone.includes(lesson.id) && (s.quiz[lesson.topic] ?? 0) >= PASS_MARK
}

/** A pass, out of 1: four out of five. */
export const PASS_MARK = 0.8

export const TOPICS: Topic[] = [
  {
    id: 'crude',
    title: 'Crude and distillation',
    questions: [
      {
        q: 'What does the crude unit split the crude by?',
        options: ['Density', 'Boiling range', 'Sulphur content', 'Viscosity'],
        answer: 1,
        why: 'Each product is a boiling range: naphtha boils lowest, then kerosene, diesel and gas oil, with the residue at the bottom.',
      },
      {
        q: 'Why is there a vacuum unit after the crude unit?',
        options: [
          'To cool the residue before storage',
          'To remove water from the crude',
          'To boil gas oil out of the residue without heating it hot enough to crack',
          'To make the residue denser',
        ],
        answer: 2,
        why: 'Above about 370 °C oil starts to crack and coke. Lowering the pressure lowers the boiling points, so gas oil can be lifted at a safe temperature.',
      },
      {
        q: 'What does API gravity tell you about a crude?',
        options: ['How light it is: higher API is lighter', 'How much sulphur it holds', 'Its price', 'How heavy it is: higher API is heavier'],
        answer: 0,
        why: 'API gravity runs the other way to density. Brent is about 38° API and light; Maya is about 22° API and heavy.',
      },
      {
        q: 'Raising a kerosene draw takes material from where?',
        options: ['Only the residue', 'From the products next to it: naphtha above and diesel below', 'From the fuel gas', 'Nowhere: it raises the crude rate'],
        answer: 1,
        why: 'The cuts share the crude between them. A bigger kerosene cut moves its boundaries into its neighbours, which changes their specs too.',
      },
      {
        q: 'Which spec usually limits how much light material kerosene can take?',
        options: ['Its colour', 'Its freeze point', 'Its flash point', 'Its sulphur'],
        answer: 2,
        why: 'Light ends lower the flash point. Stripping steam drives them back out, which is why kerosene has a side stripper.',
      },
    ],
  },
  {
    id: 'conversion',
    title: 'Cat cracking',
    questions: [
      {
        q: 'Where does the cat cracker get the heat for cracking?',
        options: ['A fired furnace on the riser', 'Burning the coke off the catalyst in the regenerator', 'Steam', 'Electric heaters'],
        answer: 1,
        why: 'The coke laid down in the riser is burnt in the regenerator, and the hot catalyst carries that heat back to the feed. The unit is in heat balance.',
      },
      {
        q: 'What happens when the riser outlet temperature is raised?',
        options: ['Less conversion and lower octane', 'More conversion, higher octane, and more gas and coke', 'Nothing until the feed rate changes', 'Only the regenerator gets cooler'],
        answer: 1,
        why: 'Hotter cracking goes further. The extra gas loads the wet gas compressor, which is often the unit’s real limit.',
      },
      {
        q: 'What do metals like nickel and vanadium do to the cat cracker?',
        options: ['Raise its octane', 'Nothing', 'Poison the catalyst and make extra hydrogen and coke', 'Lower the regenerator temperature'],
        answer: 2,
        why: 'Nickel catalyses dehydrogenation, making hydrogen and coke; vanadium destroys the zeolite. Deep vacuum cuts bring more of both.',
      },
      {
        q: 'What is the cat-to-oil ratio?',
        options: ['Catalyst circulation over feed rate, by mass', 'Coke over catalyst', 'Petrol over gas oil', 'Air over coke'],
        answer: 0,
        why: 'More catalyst per kilo of oil means more cracking sites. The slide valve sets it to hold the riser temperature.',
      },
      {
        q: 'What is the main product of a cat cracker?',
        options: ['Diesel', 'Jet fuel', 'Petrol', 'Bitumen'],
        answer: 2,
        why: 'A cat cracker is built for petrol. Its light cycle oil goes to diesel, but it is poor diesel that needs heavy treating.',
      },
    ],
  },
  {
    id: 'reforming',
    title: 'Reforming and octane',
    questions: [
      {
        q: 'What does a reformer do to naphtha?',
        options: ['Cracks it into gas', 'Turns paraffins and naphthenes into aromatics, raising octane', 'Removes its sulphur', 'Blends it with ethanol'],
        answer: 1,
        why: 'Naphthenes dehydrogenate to aromatics quickly; paraffins cyclise more slowly. Aromatics have high octane.',
      },
      {
        q: 'Why must the reformer’s feed be hydrotreated first?',
        options: ['To cool it', 'Sulphur poisons the platinum catalyst', 'To add hydrogen to it', 'To raise its octane'],
        answer: 1,
        why: 'Platinum is poisoned by sulphur at very low levels, so the naphtha hydrotreater takes it below about half a ppm.',
      },
      {
        q: 'Why do the reformer’s reactors have furnaces between them?',
        options: ['The main reactions absorb heat, so the stream cools', 'To burn the coke', 'To make steam', 'For start-up only'],
        answer: 0,
        why: 'Dehydrogenation is strongly endothermic. The first reactor’s temperature drops sharply and the gas must be reheated before the next.',
      },
      {
        q: 'What else does the reformer make that the refinery needs?',
        options: ['Sulphur', 'Hydrogen', 'Steam', 'Coke'],
        answer: 1,
        why: 'Every aromatic ring formed gives off three molecules of hydrogen, which feeds the hydrotreaters.',
      },
      {
        q: 'Why does a reformer raise its inlet temperatures over a cycle?',
        options: ['To use more fuel', 'Coke builds on the catalyst and its activity falls', 'The feed gets lighter', 'To make less hydrogen'],
        answer: 1,
        why: 'To hold octane as the catalyst cokes, operators raise the temperature, until the metal limit or the yield loss says regenerate.',
      },
    ],
  },
  {
    id: 'treating',
    title: 'Hydrotreating and sulphur',
    questions: [
      {
        q: 'What is the road diesel sulphur limit in Europe?',
        options: ['10 ppm', '50 ppm', '350 ppm', '1,000 ppm'],
        answer: 0,
        why: 'Ultra-low sulphur diesel is 10 ppm, which lets particulate filters and catalysts on modern engines work.',
      },
      {
        q: 'Where does the sulphur go in a hydrotreater?',
        options: ['Into the catalyst for good', 'Out as hydrogen sulphide gas', 'Into the diesel as sulphate', 'Up the flare'],
        answer: 1,
        why: 'Hydrogen breaks the carbon–sulphur bonds and the sulphur leaves as H₂S, which amine scrubbing collects for the sulphur plant.',
      },
      {
        q: 'In a Claus plant, what ratio of H₂S to SO₂ should reach the converters?',
        options: ['One to one', 'Two to one', 'One to two', 'Three to one'],
        answer: 1,
        why: '2 H₂S + SO₂ → 3 S + 2 H₂O. A third of the H₂S is burnt to SO₂, and the air must be held so the ratio stays at two to one.',
      },
      {
        q: 'Why is light cycle oil hard to desulphurise?',
        options: ['It is too light', 'Its sulphur sits in hindered aromatic molecules', 'It has no sulphur', 'It boils too high'],
        answer: 1,
        why: 'Molecules like 4,6-dimethyldibenzothiophene shield their sulphur atom, so it needs a hotter reactor and more hydrogen.',
      },
      {
        q: 'What does a tail gas unit do?',
        options: ['Burns the tail gas in the flare', 'Recycles the sulphur the Claus stages miss', 'Cools the sulphur', 'Makes hydrogen'],
        answer: 1,
        why: 'It turns the leftover sulphur compounds back into H₂S and sends them back to the front, lifting recovery past 99.5%.',
      },
    ],
  },
  {
    id: 'control',
    title: 'Control and alarms',
    questions: [
      {
        q: 'What does the I in a PID controller do?',
        options: ['Acts on how fast the error changes', 'Removes the steady offset by adding up the error over time', 'Sets the gain', 'Nothing in automatic'],
        answer: 1,
        why: 'Proportional action alone leaves an offset. Integral action keeps moving the output until the error is zero.',
      },
      {
        q: 'What is feed-forward control?',
        options: [
          'Raising the feed rate automatically',
          'Acting on a measured disturbance before it upsets the controlled variable',
          'Controlling the feed pump',
          'A backup controller',
        ],
        answer: 1,
        why: 'Feed-forward uses a model of how the disturbance acts. It moves the valve at once, and feedback trims what the model gets wrong.',
      },
      {
        q: 'What does acknowledging an alarm do?',
        options: ['Fixes the cause', 'Records that an operator has seen it', 'Deletes it', 'Raises its priority'],
        answer: 1,
        why: 'The alarm stays active until the condition clears. Acknowledging only silences it and marks it as seen.',
      },
      {
        q: 'Roughly how many alarms an hour can one operator handle in steady running, by EEMUA 191?',
        options: ['About 1', 'About 6', 'About 60', 'As many as come'],
        answer: 0,
        why: 'EEMUA 191 counts about one an hour as very likely acceptable. Floods of alarms in an upset have caused real accidents.',
      },
      {
        q: 'What does advanced process control usually do?',
        options: ['Replaces the operators', 'Pushes the plant against its constraints to gain throughput or yield', 'Runs only at night', 'Shuts the unit down safely'],
        answer: 1,
        why: 'APC moves setpoints of the base controllers so the unit runs as close as it safely can to its limits.',
      },
    ],
  },
  {
    id: 'business',
    title: 'The refinery as a business',
    questions: [
      {
        q: 'What is a refinery’s gross margin?',
        options: ['The crude price', 'What the products sell for less the crude', 'The profit after tax', 'The cost of fuel'],
        answer: 1,
        why: 'Gross margin is products less crude. Take off the running costs, like fuel, power and chemicals, and you get the net margin.',
      },
      {
        q: 'Why can a refinery make more barrels than it takes in?',
        options: ['Measurement error', 'Cracking makes lighter, less dense products, which take up more room', 'It buys products in', 'Water is added'],
        answer: 1,
        why: 'This is volume gain. The mass balances, but the products are less dense than the crude, so their volume is greater.',
      },
      {
        q: 'What is demurrage?',
        options: ['A crude quality', 'A fee paid when a ship waits longer than agreed', 'A tank cleaning', 'A tax on sulphur'],
        answer: 1,
        why: 'A ship that can’t berth or load on time costs tens of thousands of dollars a day, so the jetty is planned carefully.',
      },
      {
        q: 'What is octane giveaway?',
        options: ['Free petrol', 'Blending to a higher octane than the spec needs', 'Octane lost in storage', 'A price discount'],
        answer: 1,
        why: 'Every tenth of an octane above spec is expensive components given away. Planners blend as close to the spec as they dare.',
      },
      {
        q: 'Which product usually earns the least per barrel?',
        options: ['Diesel', 'Jet fuel', 'Fuel oil', 'Petrol'],
        answer: 2,
        why: 'Fuel oil is often worth less than the crude it came from. Converting the bottom of the barrel is where the money is.',
      },
    ],
  },
  {
    id: 'heavy',
    title: 'The heavy end',
    questions: [
      {
        q: 'Why does a delayed coker have two drums?',
        options: ['One is a spare', 'One fills while the other is cooled and cut out', 'For two different crudes', 'To store the coke'],
        answer: 1,
        why: 'Coking runs into a drum until it is full. The flow switches to the other drum and the full one is steamed, cooled and decoked.',
      },
      {
        q: 'What does Conradson carbon residue predict?',
        options: ['The sulphur in the coke', 'How much coke the residue will make', 'The octane of the naphtha', 'The flash point'],
        answer: 1,
        why: 'Coke yield rises steeply with the residue’s Conradson carbon. Maya residue makes far more coke than Brent.',
      },
      {
        q: 'What does a hydrocracker need far more of than a hydrotreater?',
        options: ['Steam', 'Hydrogen', 'Air', 'Water'],
        answer: 1,
        why: 'Cracking and saturating the molecules uses several times the hydrogen of simple desulphurisation.',
      },
      {
        q: 'What is recycle to extinction in a hydrocracker?',
        options: ['Burning the unconverted oil', 'Sending unconverted oil back until all of it cracks', 'Shutting down the reactor', 'Recycling the hydrogen only'],
        answer: 1,
        why: 'Each pass cracks part of the feed and the rest goes round again, so each pass can be gentle and selective for diesel.',
      },
      {
        q: 'Why does a steam methane reformer need plenty of steam?',
        options: ['To cool the tubes', 'To keep carbon from forming on the catalyst and push the reactions on', 'To make electricity', 'To clean the flue gas'],
        answer: 1,
        why: 'Below a steam-to-carbon ratio of about 2.5, methane cracking lays carbon on the catalyst. Extra steam also drives the shift reaction.',
      },
    ],
  },
]

export interface Term {
  term: string
  meaning: string
}

const TERMS: Term[] = [
  { term: 'Alkylation', meaning: 'Joins isobutane to light olefins over strong acid, making alkylate: clean, high-octane petrol with no aromatics or sulphur.' },
  { term: 'API gravity', meaning: 'The oil industry’s measure of density, running backwards: water is 10°, light crude 35–45°, heavy crude below 22°.' },
  { term: 'APC', meaning: 'Advanced process control. A layer above the basic controllers that moves their setpoints to push the unit against its limits.' },
  { term: 'Aromatics', meaning: 'Ring molecules like benzene and toluene. High in octane, but limited in petrol for health reasons.' },
  { term: 'Barrel', meaning: '42 US gallons, or about 159 litres. Refinery rates are given in thousand barrels a day, kb/d.' },
  { term: 'Blendstock', meaning: 'A component made to be blended into a finished fuel, rather than sold as one.' },
  { term: 'Bottoms', meaning: 'Whatever leaves the bottom of a column: the heaviest part of its feed.' },
  { term: 'Catalyst', meaning: 'A material that speeds a reaction without being used up. Refinery catalysts are metals or zeolites on porous supports.' },
  { term: 'Cat-to-oil ratio', meaning: 'Catalyst circulation over feed in a cat cracker, by mass. More catalyst means more cracking.' },
  { term: 'Cetane number', meaning: 'How readily diesel ignites when compressed. The diesel equivalent of octane, but higher means easier to ignite.' },
  { term: 'Claus process', meaning: 'Burns a third of the H₂S to SO₂, then reacts the two over catalyst to make elemental sulphur.' },
  { term: 'COT', meaning: 'Coil outlet temperature: how hot the oil leaves a fired heater.' },
  { term: 'Coke', meaning: 'Solid carbon left by cracking. Unwanted on catalyst; the product of a delayed coker.' },
  { term: 'Conradson carbon', meaning: 'The residue left when an oil is heated without air, as a % of its mass. It predicts coke make.' },
  { term: 'Conversion', meaning: 'The share of feed a cracking unit turns into lighter products.' },
  { term: 'Crack spread', meaning: 'The difference between product prices and the crude price: a rough measure of refining margin.' },
  { term: 'Cut point', meaning: 'The boiling temperature that divides one product from the next.' },
  { term: 'DCS', meaning: 'Distributed control system. The computers that run the controllers and show the operators the plant.' },
  { term: 'Dead time', meaning: 'The delay before a change made at one end of a process is seen at the other.' },
  { term: 'Delayed coking', meaning: 'Heats residue and lets it crack in a drum until the drum fills with coke. Two drums take turns.' },
  { term: 'Demurrage', meaning: 'The charge for keeping a ship waiting beyond the time agreed for loading or discharging.' },
  { term: 'Desalter', meaning: 'Washes salt and water out of crude before the furnace, to stop corrosion and fouling.' },
  { term: 'Distillation', meaning: 'Separating a mixture by boiling point: lighter material rises as vapour, heavier falls as liquid.' },
  { term: 'EEMUA 191', meaning: 'The industry guide to alarm systems: how many alarms an operator can handle, and how to prioritise them.' },
  { term: 'Endothermic', meaning: 'A reaction that takes in heat. Reforming and cracking both are.' },
  { term: 'End point', meaning: 'The temperature at which the last of a product boils away.' },
  { term: 'Feed-forward', meaning: 'Control that acts on a measured disturbance before it reaches the controlled variable.' },
  { term: 'Flash point', meaning: 'The lowest temperature at which a fuel’s vapour can be lit. A safety spec for kerosene and diesel.' },
  { term: 'Flash zone', meaning: 'Where the hot crude enters the column and splits into vapour and liquid.' },
  { term: 'Flare', meaning: 'A tall burner that safely burns gas released in an upset or emergency.' },
  { term: 'Fouling', meaning: 'Deposits building up in exchangers or pipes, cutting heat transfer.' },
  { term: 'Fractionator', meaning: 'Another name for a distillation column, especially one after a reactor.' },
  { term: 'Fuel oil', meaning: 'Heavy residual fuel, burnt in ships and power stations. Usually worth less than crude.' },
  { term: 'Gas oil', meaning: 'Oil boiling roughly between diesel and residue. Feed for the cat cracker and hydrocracker.' },
  { term: 'Hydrocracker', meaning: 'Cracks gas oil under high hydrogen pressure, making clean diesel, jet and naphtha.' },
  { term: 'Hydrogen sulphide', meaning: 'H₂S. A toxic gas made when sulphur is removed from oil. Smells of rotten eggs at low levels and deadens the sense of smell at high ones.' },
  { term: 'Hydrotreater', meaning: 'Removes sulphur and nitrogen from a stream by reacting it with hydrogen over catalyst.' },
  { term: 'Isomerisation', meaning: 'Rearranges straight-chain light naphtha into branched molecules with higher octane.' },
  { term: 'Kerosene', meaning: 'The cut boiling roughly from 150 to 250 °C. Treated, it becomes jet fuel.' },
  { term: 'LCO', meaning: 'Light cycle oil: the cat cracker’s diesel-range product. High in aromatics and hard-to-remove sulphur.' },
  { term: 'Linear programme', meaning: 'An optimiser that finds the best of many choices under linear limits. Refinery planners use them to choose crudes and blends.' },
  { term: 'LPG', meaning: 'Liquefied petroleum gas: propane and butane.' },
  { term: 'Margin', meaning: 'What the products sell for less what the crude and running costs cost.' },
  { term: 'MON', meaning: 'Motor octane number: octane measured under harder conditions than RON. Always the lower of the two.' },
  { term: 'Naphtha', meaning: 'The lightest liquid cut, boiling below about 180 °C. Feed for the reformer and isomerisation.' },
  { term: 'Naphthenes', meaning: 'Saturated ring molecules. The reformer turns them into aromatics easily.' },
  { term: 'Octane', meaning: 'A petrol’s resistance to knocking. Branched and aromatic molecules have high octane.' },
  { term: 'Overflash', meaning: 'Extra vapour lifted in the flash zone that falls back as liquid, keeping the trays below wet.' },
  { term: 'Paraffins', meaning: 'Saturated chain molecules. Straight ones have low octane and good cetane.' },
  { term: 'PFD', meaning: 'Process flow diagram: the main equipment and streams of a unit.' },
  { term: 'PID', meaning: 'Proportional, integral, derivative: the control law in most of a plant’s controllers.' },
  { term: 'Reformate', meaning: 'The reformer’s high-octane, aromatic-rich product.' },
  { term: 'Regenerator', meaning: 'The vessel where coke is burnt off the cat cracker’s catalyst, heating it for the next pass.' },
  { term: 'Residue', meaning: 'What doesn’t boil in the column. Atmospheric residue boils above about 370 °C, vacuum residue above about 565 °C.' },
  { term: 'Riser', meaning: 'The vertical pipe where hot catalyst and gas oil meet and crack, in two or three seconds.' },
  { term: 'RON', meaning: 'Research octane number: the octane on the pump in Europe.' },
  { term: 'RVP', meaning: 'Reid vapour pressure: how readily petrol evaporates. Limited in summer to cut smog.' },
  { term: 'Setpoint', meaning: 'The value a controller is told to hold.' },
  { term: 'SMR', meaning: 'Steam methane reformer: makes hydrogen from natural gas and steam in catalyst-filled tubes in a furnace.' },
  { term: 'Sour', meaning: 'Containing sulphur. A sour crude has more than about 0.5% sulphur.' },
  { term: 'Steam-to-carbon ratio', meaning: 'Moles of steam per mole of carbon fed to an SMR. Too low and carbon forms on the catalyst.' },
  { term: 'Stripper', meaning: 'A small column that uses steam or heat to drive light material out of a liquid.' },
  { term: 'Tag', meaning: 'A named measurement or controller in the DCS, like TI-101 for a temperature indicator.' },
  { term: 'Turnaround', meaning: 'A planned shutdown of a unit for inspection, cleaning and repair, every few years.' },
  { term: 'Vacuum distillation', meaning: 'Distillation at low pressure, which lowers boiling points so gas oil can be lifted without cracking.' },
  { term: 'Volume gain', meaning: 'Cracked products are less dense than their feed, so a refinery can make more barrels than it takes in.' },
  { term: 'WAIT', meaning: 'Weighted average inlet temperature of a reformer’s reactors.' },
  { term: 'Zeolite', meaning: 'A crystalline aluminosilicate with molecule-sized pores. The active part of cat cracking catalyst.' },
]

/** Every term, A to Z. */
export const GLOSSARY = [...TERMS].sort((a, b) => a.term.localeCompare(b.term))

/** Searches the glossary by term and meaning, terms first. */
export function searchGlossary(query: string): Term[] {
  const q = query.trim().toLowerCase()
  if (!q) return GLOSSARY
  const inTerm = GLOSSARY.filter((t) => t.term.toLowerCase().includes(q))
  const inMeaning = GLOSSARY.filter((t) => !inTerm.includes(t) && t.meaning.toLowerCase().includes(q))
  return [...inTerm, ...inMeaning]
}

/** The key readings an engineer jots down, for the notebook. */
export function readings(p: Plant): { label: string; value: string }[] {
  const t = treatingResult(p)
  const s = siteBalance(p)
  const { cdu, fcc } = t.conversion
  return [
    { label: 'Crude', value: `${p.furnace.crude[0].toUpperCase()}${p.furnace.crude.slice(1)} at ${p.furnace.feed.toFixed(0)} kb/d` },
    { label: 'Furnace outlet', value: `${p.furnace.outlet.toFixed(1)} °C` },
    { label: 'Kerosene', value: `${cdu.products.kerosene.percent.toFixed(1)}% of crude` },
    { label: 'Cat cracker', value: `${fcc.conversion.toFixed(1)}% conversion, ${fcc.octane.toFixed(1)} RON` },
    { label: 'Reformate', value: `${t.reforming.reformer.octane.toFixed(1)} RON` },
    { label: 'Diesel sulphur', value: `${t.dht.sulphurOut.toFixed(1)} ppm` },
    { label: 'Sulphur recovery', value: `${t.sru.recovery.toFixed(2)}%` },
    { label: 'Site margin', value: `${money(s.margin)} a day, ${s.perBarrel < 0 ? '−' : ''}$${Math.abs(s.perBarrel).toFixed(2)}/bbl` },
  ]
}
