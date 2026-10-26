// The units of a complex refinery, for the site board: what each does, the
// conditions it runs at and the chemistry inside. Figures are typical ranges
// from refining references (Gary and Handwerk's Petroleum Refining, and
// licensors' published descriptions); individual plants vary.

export type UnitId =
  | 'desalter'
  | 'cdu'
  | 'vdu'
  | 'gasPlant'
  | 'isom'
  | 'nht'
  | 'reformer'
  | 'keroTreater'
  | 'dht'
  | 'fcc'
  | 'alky'
  | 'hydrocracker'
  | 'coker'
  | 'amine'
  | 'sru'

export interface RefineryUnit {
  id: UnitId
  name: string
  short: string
  /** Which stage of the Atlas's refinery lets you run it: 1 is now. */
  stage: number
  does: string
  conditions: string[]
  chemistry?: string
  why: string
}

export const UNITS: Record<UnitId, RefineryUnit> = {
  desalter: {
    id: 'desalter',
    name: 'Desalter',
    short: 'Desalter',
    stage: 1,
    does: 'Washes salt, water and sediment out of the crude before it is heated. The crude is mixed with 4–8% fresh water and passed between electrodes, whose field makes the water droplets merge and settle out.',
    conditions: ['120–150 °C', 'Enough pressure to keep the water liquid', 'Salt down to a few pounds per thousand barrels'],
    why: 'Magnesium and calcium chlorides break down to hydrochloric acid in the furnace and condense in the column overhead, corroding it. Salt also fouls exchangers and poisons catalysts downstream.',
  },
  cdu: {
    id: 'cdu',
    name: 'Crude distillation unit',
    short: 'Crude unit',
    stage: 1,
    does: 'Heats the crude to about 360 °C and separates it by boiling range in a tall column with around 30–50 trays: gas and naphtha overhead, kerosene and diesel from the side, residue from the bottom.',
    conditions: ['Furnace outlet 340–370 °C', 'Top about 1–1.5 bar gauge', 'Stripping steam in the bottom and the side strippers'],
    why: 'Every barrel passes through it first, and it sets the feed for every other unit. Run it now: go to the column at the middle of the site, or the control room.',
  },
  vdu: {
    id: 'vdu',
    name: 'Vacuum distillation unit',
    short: 'Vacuum unit',
    stage: 2,
    does: 'Distils the atmospheric residue again under vacuum, which lowers boiling points by 100–150 °C, so heavy gas oils can be boiled off without cracking. What remains is vacuum residue.',
    conditions: ['Furnace outlet 390–420 °C', 'Flash zone 25–100 mmHg absolute', 'Column often 10–15 m across, for the huge vapour volume'],
    why: 'Vacuum gas oil is the main feed for the catalytic cracker and hydrocracker, where it becomes petrol and diesel.',
  },
  gasPlant: {
    id: 'gasPlant',
    name: 'Gas plant',
    short: 'Gas plant',
    stage: 4,
    does: 'Separates the light gases from all over the refinery in a series of columns: fuel gas (methane, ethane, hydrogen), propane and butanes.',
    conditions: ['Absorbers and debutaniser at 10–20 bar', 'Depropaniser and deisobutaniser in sequence'],
    why: 'Fuel gas fires the refinery furnaces; propane and butane are sold as LPG; isobutane feeds the alkylation unit.',
  },
  isom: {
    id: 'isom',
    name: 'Isomerisation',
    short: 'Isomerisation',
    stage: 3,
    does: 'Rearranges straight-chain pentanes and hexanes into branched ones, which knock far less in an engine.',
    conditions: ['120–180 °C on chlorided alumina, or about 250 °C on zeolite', 'Hydrogen, 20–30 bar', 'Unconverted straight chains recycled'],
    chemistry: 'n-pentane → isopentane; n-hexane → 2,2-dimethylbutane. Octane rises from about 70 to 87–92.',
    why: 'Light naphtha is too low in octane for petrol as it comes from the crude.',
  },
  nht: {
    id: 'nht',
    name: 'Naphtha hydrotreater',
    short: 'Naphtha HT',
    stage: 3,
    does: 'Reacts the heavy naphtha with hydrogen over a catalyst to turn its sulphur and nitrogen into hydrogen sulphide and ammonia, which are stripped out.',
    conditions: ['300–340 °C', '20–35 bar of hydrogen', 'Cobalt–molybdenum or nickel–molybdenum catalyst', 'Sulphur and nitrogen to under 0.5 ppm'],
    chemistry: 'R–SH + H₂ → R–H + H₂S',
    why: "The reformer's platinum catalyst is poisoned by even traces of sulphur and nitrogen.",
  },
  reformer: {
    id: 'reformer',
    name: 'Catalytic reformer',
    short: 'Reformer',
    stage: 3,
    does: 'Reshapes naphtha molecules into aromatics and branched paraffins over a platinum catalyst, turning a 40–60 octane feed into reformate of 95–105 octane, and producing hydrogen as it goes.',
    conditions: [
      '490–530 °C at each reactor inlet',
      '3.5 bar (continuous regeneration) to 25 bar (semi-regenerative)',
      'Platinum–tin or platinum–rhenium on chlorided alumina',
      'Three or four reactors with a furnace before each, because the reactions absorb heat',
    ],
    chemistry: 'Methylcyclohexane → toluene + 3 H₂ (dehydrogenation); n-heptane → toluene + 4 H₂ (dehydrocyclisation)',
    why: "It is the refinery's main source of high-octane petrol and of the hydrogen every hydrotreater needs.",
  },
  keroTreater: {
    id: 'keroTreater',
    name: 'Kerosene treater',
    short: 'Kero treater',
    stage: 4,
    does: 'Removes mercaptans (smelly, corrosive sulphur compounds) from kerosene, either by oxidising them to harmless disulphides (Merox) or by hydrotreating.',
    conditions: ['Merox: 30–50 °C, caustic and air over a cobalt catalyst', 'or hydrotreating at 300–350 °C'],
    why: 'Jet A-1 limits mercaptan sulphur to 0.003% and total sulphur to 0.3%, and must pass strict tests for corrosion and stability.',
  },
  dht: {
    id: 'dht',
    name: 'Diesel hydrotreater',
    short: 'Diesel HT',
    stage: 4,
    does: 'Removes sulphur from diesel with hydrogen over a catalyst, from thousands of ppm down to under 10.',
    conditions: ['330–380 °C', '30–70 bar of hydrogen', 'Nickel–molybdenum or cobalt–molybdenum catalyst', 'The last sulphur atoms, shielded in dibenzothiophenes, are the hardest to reach'],
    chemistry: 'Dibenzothiophene + 2 H₂ → biphenyl + H₂S',
    why: 'Road diesel in Europe and the US is limited to 10–15 ppm of sulphur, for cleaner exhaust and to protect exhaust catalysts.',
  },
  fcc: {
    id: 'fcc',
    name: 'Fluid catalytic cracker',
    short: 'Cat cracker',
    stage: 2,
    does: 'Cracks heavy gas oil into petrol, LPG and light cycle oil on a fine zeolite catalyst powder that flows like a liquid. The catalyst meets hot oil in a riser for a few seconds, then goes to a regenerator where the coke it picked up is burnt off, heating it for the next pass.',
    conditions: [
      'Riser outlet 500–550 °C',
      'Regenerator 680–750 °C',
      'Catalyst to oil ratio about 5–8 by weight',
      '2–4 seconds of contact in the riser',
      'About 70–80% conversion',
    ],
    chemistry: 'C₁₆H₃₄ → C₈H₁₈ + C₈H₁₆, by carbocation chemistry on acid sites in zeolite Y',
    why: 'The workhorse of petrol-making: in a typical US refinery it makes around a third of the petrol. It is heat balanced, burning its own coke for all the heat it needs.',
  },
  alky: {
    id: 'alky',
    name: 'Alkylation unit',
    short: 'Alkylation',
    stage: 4,
    does: 'Joins isobutane to the propylene and butylenes from the cat cracker, making alkylate: a clean, high-octane petrol component with no aromatics or sulphur.',
    conditions: ['Sulphuric acid at 5–10 °C, or hydrofluoric acid at 30–40 °C', 'A large excess of isobutane'],
    chemistry: 'isobutane + 2-butene → 2,2,4-trimethylpentane (isooctane, octane 100)',
    why: 'Alkylate lifts petrol octane without the aromatics that emission rules limit.',
  },
  hydrocracker: {
    id: 'hydrocracker',
    name: 'Hydrocracker',
    short: 'Hydrocracker',
    stage: 5,
    does: 'Cracks heavy gas oil in a large excess of hydrogen, on a catalyst that both cracks (acid sites) and hydrogenates (metal sites). Makes very clean jet and diesel.',
    conditions: ['350–430 °C', '100–200 bar of hydrogen', 'Hydrotreating catalyst first, then cracking catalyst'],
    why: 'The best route from heavy oil to middle distillates, and the biggest user of hydrogen in the refinery.',
  },
  coker: {
    id: 'coker',
    name: 'Delayed coker',
    short: 'Coker',
    stage: 5,
    does: 'Heats vacuum residue and lets it crack slowly in huge drums, until what is left is solid petroleum coke. The cracked vapours become naphtha, gas oil and gas. Drums are filled and emptied in turn: the coke is cut out with high-pressure water jets.',
    conditions: ['Furnace outlet 490–505 °C', 'Drums at 1–3 bar', 'About 15–24 hours to fill each drum'],
    why: 'Turns the bottom of the barrel, which would otherwise be low-value fuel oil, into lighter products. Coke is sold as fuel or for anodes.',
  },
  amine: {
    id: 'amine',
    name: 'Amine treating',
    short: 'Amine unit',
    stage: 4,
    does: 'Washes hydrogen sulphide out of the refinery gas with an amine solution (usually MDEA), then boils it off again in a regenerator, sending concentrated H₂S to sulphur recovery.',
    conditions: ['Absorber around 40 °C', 'Regenerator about 120 °C, near atmospheric pressure'],
    why: 'Every hydrotreater turns sulphur into H₂S, which is deadly at a few hundred ppm and cannot be burnt as fuel.',
  },
  sru: {
    id: 'sru',
    name: 'Sulphur recovery (Claus)',
    short: 'Sulphur plant',
    stage: 4,
    does: 'Burns a third of the hydrogen sulphide to sulphur dioxide, then reacts the two together over alumina catalyst to make liquid sulphur.',
    conditions: ['Reaction furnace about 1,000–1,400 °C', 'Two or three catalytic stages at 200–350 °C', 'Over 99.9% recovery with tail gas treatment'],
    chemistry: '2 H₂S + SO₂ → 3 S + 2 H₂O',
    why: 'A large refinery can make hundreds of tonnes of sulphur a day, sold for fertiliser and sulphuric acid.',
  },
}

/** Places on the site board's block diagram (x, y of the top-left corner). */
export const BOARD_LAYOUT: Record<UnitId, [number, number]> = {
  desalter: [110, 210],
  cdu: [230, 120],
  gasPlant: [440, 20],
  isom: [440, 80],
  nht: [440, 140],
  keroTreater: [440, 200],
  dht: [440, 260],
  vdu: [440, 360],
  reformer: [660, 140],
  fcc: [660, 330],
  hydrocracker: [660, 260],
  alky: [660, 20],
  coker: [660, 430],
  amine: [110, 400],
  sru: [110, 460],
}
export const BOARD_BOX = { w: 120, h: 40 }
/** The CDU spans several rows on the board. */
export const CDU_BOX = { w: 110, h: 220 }

export type ProductOut = 'lpg' | 'petrol' | 'jet' | 'diesel' | 'fuelOil' | 'coke' | 'sulphur'
export const OUTPUTS: Record<ProductOut, { name: string; y: number }> = {
  lpg: { name: 'LPG', y: 40 },
  petrol: { name: 'Petrol', y: 120 },
  jet: { name: 'Jet fuel', y: 220 },
  diesel: { name: 'Diesel', y: 280 },
  fuelOil: { name: 'Fuel oil, bitumen', y: 380 },
  coke: { name: 'Petroleum coke', y: 450 },
  sulphur: { name: 'Sulphur', y: 480 },
}

/** Streams on the block diagram: [from, to, label]. */
export const STREAMS: [UnitId | 'crude', UnitId | ProductOut, string][] = [
  ['crude', 'desalter', 'crude'],
  ['desalter', 'cdu', ''],
  ['cdu', 'gasPlant', 'gas'],
  ['cdu', 'isom', 'light naphtha'],
  ['cdu', 'nht', 'heavy naphtha'],
  ['cdu', 'keroTreater', 'kerosene'],
  ['cdu', 'dht', 'diesel'],
  ['cdu', 'vdu', 'residue'],
  ['gasPlant', 'lpg', ''],
  ['gasPlant', 'alky', 'isobutane'],
  ['isom', 'petrol', 'isomerate'],
  ['nht', 'reformer', ''],
  ['reformer', 'petrol', 'reformate'],
  ['alky', 'petrol', 'alkylate'],
  ['keroTreater', 'jet', ''],
  ['dht', 'diesel', ''],
  ['vdu', 'fcc', 'gas oil'],
  ['vdu', 'hydrocracker', 'gas oil'],
  ['vdu', 'coker', 'vac. residue'],
  ['vdu', 'fuelOil', ''],
  ['fcc', 'petrol', 'cat petrol'],
  ['fcc', 'alky', 'olefins'],
  ['hydrocracker', 'jet', ''],
  ['hydrocracker', 'diesel', ''],
  ['coker', 'coke', ''],
  ['amine', 'sru', 'H₂S'],
  ['sru', 'sulphur', ''],
]
