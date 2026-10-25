import type { Discovery } from './types.ts'

// Curated, reviewed discoveries (spec section 5.1: "a curated database of
// reviewed discoveries rather than uncontrolled AI generation"). Ordered so
// consecutive days move between subjects. Each entry cites a source.

export const discoveries: Discovery[] = [
  {
    id: 'paper-fold-moon',
    topic: 'Science',
    question: 'If you could fold an ordinary sheet of paper in half 42 times, how thick would it be?',
    answer: 'Thick enough to reach past the Moon.',
    explanation:
      'Each fold doubles the thickness. A 0.1 mm sheet folded 42 times is 0.1 mm × 2⁴², about 440,000 km, while the Moon is on average about 384,000 km away.',
    more:
      'This is exponential growth: small steps that double quickly become enormous. In practice paper resists folding long before that; the record for a single long strip of paper is 12 folds, set by Britney Gallivan in 2002, who also worked out the maths of why it gets so hard.',
    related: ['Exponential growth', 'Compound interest', 'Powers of two'],
    source: { title: 'Wikipedia: Exponential growth', url: 'https://en.wikipedia.org/wiki/Exponential_growth' },
  },
  {
    id: 'sharks-older-than-trees',
    topic: 'Biology',
    question: 'Which appeared on Earth first: sharks or trees?',
    answer: 'Sharks, by tens of millions of years.',
    explanation:
      'The earliest shark-like scales are about 450 million years old. The first true trees, such as Archaeopteris, appear in the Devonian period around 385 million years ago.',
    more:
      'Sharks have since survived all five mass extinctions. Their skeletons are cartilage, which rarely fossilises, so much of their early history is known from teeth and scales.',
    related: ['Devonian period', 'Mass extinctions', 'Fossilisation'],
    source: { title: 'Wikipedia: Evolution of sharks', url: 'https://en.wikipedia.org/wiki/Evolution_of_sharks' },
  },
  {
    id: 'cleopatra-moon-landing',
    topic: 'History',
    question: 'Did Cleopatra live closer in time to the building of the Great Pyramid, or to the Moon landing?',
    answer: 'To the Moon landing.',
    explanation:
      'The Great Pyramid of Giza was finished around 2560 BC. Cleopatra died in 30 BC, about 2,500 years later. The Apollo 11 landing in 1969 came about 2,000 years after her.',
    more:
      'Ancient Egypt lasted so long that it was already ancient to the ancient Egyptians. Cleopatra herself was of Macedonian Greek descent, the last ruler of the Ptolemaic dynasty founded after Alexander the Great.',
    related: ['Ptolemaic Kingdom', 'Deep time', 'Apollo 11'],
    source: { title: 'Wikipedia: Cleopatra', url: 'https://en.wikipedia.org/wiki/Cleopatra' },
  },
  {
    id: 'france-time-zones',
    topic: 'Geography',
    question: 'Which country uses the most time zones?',
    answer: 'France, with 12 (13 counting its Antarctic claim).',
    explanation:
      'Overseas regions and territories spread across the Atlantic, Indian and Pacific Oceans, from French Polynesia to Réunion and New Caledonia, give France more time zones than Russia or the United States.',
    more:
      'China, about as wide as the continental United States, uses a single time zone. In the far west of China the sun can rise around 10 am by the clock.',
    related: ['Overseas France', 'Coordinated Universal Time', 'Time zones of China'],
    source: { title: 'Wikipedia: Time in France', url: 'https://en.wikipedia.org/wiki/Time_in_France' },
  },
  {
    id: 'spacing-effect',
    topic: 'Psychology',
    question: 'Is it better to study something for three hours once, or for one hour on three separate days?',
    answer: 'Three separate days, by a wide margin.',
    explanation:
      'The spacing effect is one of the most replicated findings in memory research: reviewing material across spaced sessions leads to much better long-term recall than cramming the same total time.',
    more:
      'Hermann Ebbinghaus described it in the 1880s while testing himself on nonsense syllables, alongside his "forgetting curve". Flashcard apps that schedule reviews just before you are likely to forget are built on this idea.',
    related: ['Forgetting curve', 'Spaced repetition', 'Retrieval practice'],
    source: { title: 'Wikipedia: Spacing effect', url: 'https://en.wikipedia.org/wiki/Spacing_effect' },
  },
  {
    id: 'eiffel-summer',
    topic: 'Engineering',
    question: 'Is the Eiffel Tower the same height in summer and winter?',
    answer: 'No. It can grow by up to about 15 cm in the summer heat.',
    explanation:
      'Iron expands as it warms. Over 300 metres of iron, a change in temperature adds up to a measurable change in height, and the sunny side expands more, so the top leans slightly away from the sun.',
    more:
      'Engineers design for thermal expansion everywhere: the gaps in railway lines, the toothed joints on bridges, and the loops in long pipelines all let materials grow and shrink without cracking.',
    related: ['Thermal expansion', 'Expansion joints', 'Gustave Eiffel'],
    source: { title: 'Wikipedia: Eiffel Tower', url: 'https://en.wikipedia.org/wiki/Eiffel_Tower' },
  },
  {
    id: 'ship-of-theseus',
    topic: 'Philosophy',
    question: 'If every plank of a ship is replaced one by one, is it still the same ship?',
    answer: 'Philosophers have argued about it for over two thousand years.',
    explanation:
      'Plutarch described the ship of the hero Theseus, kept by the Athenians, whose rotting planks were replaced until none of the originals remained. Thomas Hobbes added a twist: what if someone rebuilt a second ship from all the old planks? Which one is the real ship?',
    more:
      'The puzzle matters for people too. Most of the cells in your body are replaced over time, and your memories and beliefs change. What makes you the same person you were ten years ago: your matter, your shape, your history, or the continuity of your mind?',
    related: ['Personal identity', 'Sorites paradox', 'Mereology'],
    source: { title: 'Wikipedia: Ship of Theseus', url: 'https://en.wikipedia.org/wiki/Ship_of_Theseus' },
  },
  {
    id: 'first-computer-bug',
    topic: 'Technology',
    question: 'Was the first computer "bug" an actual insect?',
    answer: 'A real moth was found in a computer in 1947, but the word "bug" is older.',
    explanation:
      'Operators of the Harvard Mark II found a moth trapped in a relay and taped it into their logbook with the note "First actual case of bug being found". The joke worked because engineers already called faults "bugs".',
    more:
      'Thomas Edison wrote about "bugs" in his inventions in the 1870s. The logbook page, with the moth still attached, is held by the Smithsonian National Museum of American History. Grace Hopper, who worked on the Mark II, loved telling the story.',
    related: ['Grace Hopper', 'Harvard Mark II', 'Debugging'],
    source: { title: 'Wikipedia: Software bug', url: 'https://en.wikipedia.org/wiki/Software_bug#History' },
  },
  {
    id: 'salary-salt',
    topic: 'Culture',
    question: 'Were Roman soldiers really paid in salt, giving us the word "salary"?',
    answer: 'Probably not, although the word does come from salt.',
    explanation:
      '"Salary" comes from the Latin salarium, which is related to sal, salt. But there is no good ancient evidence that soldiers were paid in salt itself; salarium seems to have been an allowance whose original link to salt is unclear.',
    more:
      'Salt was valuable in the ancient world, which makes the story feel right, and it is repeated in many books. It is a good example of a tidy etymology that outruns the evidence. Historians call these "folk etymologies".',
    related: ['Folk etymology', 'History of salt', 'Roman army'],
    source: { title: 'Wikipedia: Salary', url: 'https://en.wikipedia.org/wiki/Salary#History' },
  },
  {
    id: 'venus-day-year',
    topic: 'Science',
    question: 'On which planet is a day longer than a year?',
    answer: 'Venus.',
    explanation:
      'Venus takes about 243 Earth days to spin once on its axis, but only about 225 Earth days to orbit the Sun. It also spins backwards compared with most planets, so the Sun rises in the west.',
    more:
      'Because of the slow, backwards spin combined with its orbit, the time from one sunrise to the next on Venus is about 117 Earth days. Its thick carbon dioxide atmosphere keeps the surface around 465 °C, hotter than Mercury.',
    related: ['Retrograde rotation', 'Greenhouse effect', 'Solar day'],
    source: { title: 'NASA: Venus facts', url: 'https://science.nasa.gov/venus/venus-facts/' },
  },
  {
    id: 'octopus-hearts',
    topic: 'Biology',
    question: 'How many hearts does an octopus have?',
    answer: 'Three, and its blood is blue.',
    explanation:
      'Two hearts pump blood through the gills and a third pumps it around the body. The blood carries oxygen with a copper-based protein called haemocyanin, which turns blue when it holds oxygen.',
    more:
      'Haemocyanin works well in cold, low-oxygen water. Octopuses also have about two thirds of their neurons in their arms, which can taste, touch and react with a surprising amount of independence.',
    related: ['Haemocyanin', 'Cephalopod intelligence', 'Distributed nervous systems'],
    source: { title: 'Wikipedia: Octopus', url: 'https://en.wikipedia.org/wiki/Octopus#Circulation' },
  },
  {
    id: 'oxford-aztecs',
    topic: 'History',
    question: 'Which is older: the University of Oxford or the Aztec city of Tenochtitlan?',
    answer: 'Oxford, by more than two centuries.',
    explanation:
      'There was teaching at Oxford by 1096. Tenochtitlan, the Aztec capital, was founded in 1325 on an island in Lake Texcoco, where Mexico City stands today.',
    more:
      'Tenochtitlan grew into one of the largest cities in the world, with perhaps 200,000 people, causeways, aqueducts and floating gardens called chinampas, before it fell to Spanish forces and their allies in 1521.',
    related: ['Tenochtitlan', 'Medieval universities', 'Chinampas'],
    source: { title: 'Wikipedia: University of Oxford', url: 'https://en.wikipedia.org/wiki/University_of_Oxford#History' },
  },
  {
    id: 'westbourne-sloane-square',
    topic: 'Geography',
    question: 'At one London Underground station, a river passes over the platforms. Which one?',
    answer: 'Sloane Square, where the River Westbourne runs through a large iron pipe.',
    explanation:
      'The Westbourne once flowed openly from Hampstead to the Thames and fed the Serpentine in Hyde Park. As London grew it was buried, and when the railway was built in the 1860s the river was carried across the station in a pipe you can still see above the tracks.',
    more:
      'London has many "lost rivers", including the Fleet, the Tyburn and the Effra. Most now run through sewers or culverts beneath streets whose names and curves still follow their old courses.',
    related: ['Subterranean rivers of London', 'River Fleet', 'Joseph Bazalgette'],
    source: { title: 'Wikipedia: River Westbourne', url: 'https://en.wikipedia.org/wiki/River_Westbourne' },
  },
  {
    id: 'frequency-illusion',
    topic: 'Psychology',
    question: 'Why do you suddenly see a word or car everywhere right after you first notice it?',
    answer: 'The frequency illusion: it was always there, but now your attention is tuned to it.',
    explanation:
      'Once something becomes meaningful to you, selective attention picks it out from the background, and confirmation bias makes each sighting feel like evidence that it has become more common.',
    more:
      'The linguist Arnold Zwicky named it in 2005. It is also called the Baader–Meinhof phenomenon, after a reader who noticed the name of the group twice in one day.',
    related: ['Selective attention', 'Confirmation bias', 'Recency illusion'],
    source: { title: 'Wikipedia: Frequency illusion', url: 'https://en.wikipedia.org/wiki/Frequency_illusion' },
  },
  {
    id: 'roman-concrete',
    topic: 'Engineering',
    question: 'Why has Roman concrete lasted two thousand years when modern concrete can crumble in decades?',
    answer: 'Partly because it could heal its own cracks.',
    explanation:
      'A 2023 study found that small white lumps of lime in Roman concrete, long thought to be poor mixing, act as a reservoir. When water seeps into a crack, it dissolves the lime, which recrystallises as calcium carbonate and seals the gap.',
    more:
      'The Romans probably mixed quicklime in "hot", which created these lime clasts. Their marine concrete, made with volcanic ash, actually grows stronger minerals when soaked in seawater. Researchers are now testing self-healing mixes inspired by it.',
    related: ['Pozzolana', 'Pantheon, Rome', 'Self-healing materials'],
    source: { title: 'Seymour et al. (2023), Science Advances', url: 'https://doi.org/10.1126/sciadv.add1602' },
  },
  {
    id: 'experience-machine',
    topic: 'Philosophy',
    question: 'Would you plug into a machine that gave you a lifetime of perfect experiences, if none of them were real?',
    answer: 'Most people say no, and that tells us something about what we value.',
    explanation:
      'Robert Nozick proposed the "experience machine" in 1974 to challenge the idea that pleasure is all that matters. If we would refuse it, he argued, we must care about actually doing things and being a certain kind of person, not just feeling as if we are.',
    more:
      'Later studies suggest our answers depend on the framing: when people are told their current life is already the machine, many would rather stay plugged in. That hints at a preference for the familiar, not only for reality.',
    related: ['Hedonism', 'Simulation hypothesis', 'Status quo bias'],
    source: { title: 'Wikipedia: Experience machine', url: 'https://en.wikipedia.org/wiki/Experience_machine' },
  },
  {
    id: 'gps-relativity',
    topic: 'Technology',
    question: 'Would satellite navigation work without Einstein?',
    answer: 'Not for long. GPS clocks must be corrected for relativity.',
    explanation:
      'Satellite clocks move fast, which slows them slightly (special relativity), but sit higher in Earth\'s gravity, which speeds them up more (general relativity). Overall they gain about 38 microseconds a day.',
    more:
      'Light travels about 11 km in 38 microseconds, so without correction, positions would drift by kilometres every day. The satellite clocks are deliberately set to tick slightly slow before launch to compensate.',
    related: ['Time dilation', 'Atomic clocks', 'General relativity'],
    source: { title: 'Wikipedia: Error analysis for the GPS', url: 'https://en.wikipedia.org/wiki/Error_analysis_for_the_Global_Positioning_System#Relativity' },
  },
  {
    id: 'ok-origin',
    topic: 'Culture',
    question: 'Where does the word "OK" come from?',
    answer: 'A joke abbreviation of "oll korrect" printed in a Boston newspaper in 1839.',
    explanation:
      'In the 1830s, playful misspelled abbreviations were a fashion in American newspapers. "O.K." for "oll korrect" (all correct) appeared in the Boston Morning Post in March 1839 and, unlike the others, it survived.',
    more:
      'It spread through the 1840 presidential campaign of Martin Van Buren, nicknamed "Old Kinderhook", whose supporters formed "O.K. Clubs". The origin was traced by the linguist Allen Walker Read in the 1960s.',
    related: ['Etymology', 'Martin Van Buren', 'Slang'],
    source: { title: 'Wikipedia: OK', url: 'https://en.wikipedia.org/wiki/OK' },
  },
  {
    id: 'sunlight-age',
    topic: 'Science',
    question: 'Sunlight takes about eight minutes to reach us. How long did it take to leave the Sun?',
    answer: 'Tens of thousands of years or more.',
    explanation:
      'Energy made by fusion in the Sun\'s core is absorbed and re-emitted countless times in the dense layers above, taking a random walk outwards. Estimates for the journey range from around 10,000 to over 100,000 years.',
    more:
      'Near the surface, the energy is carried by boiling convection instead, which you can see as the grainy pattern on solar images. Only from the visible surface, the photosphere, does light escape freely across space.',
    related: ['Random walk', 'Nuclear fusion', 'Photosphere'],
    source: { title: 'NASA: Sun facts', url: 'https://science.nasa.gov/sun/facts/' },
  },
  {
    id: 'bacteria-cells',
    topic: 'Biology',
    question: 'Are there ten bacteria in your body for every human cell?',
    answer: 'No. The best estimate is closer to one to one.',
    explanation:
      'The ten-to-one figure came from a rough 1970s estimate. A 2016 study re-counted and found about 38 trillion bacteria and 30 trillion human cells in a typical adult, most of the bacteria living in the colon.',
    more:
      'Most of your human cells by number are red blood cells. Because bacteria are tiny, they make up only about 0.2 kg of your weight. The ratio even shifts after each trip to the toilet.',
    related: ['Gut microbiome', 'Red blood cells', 'Scientific estimation'],
    source: { title: 'Sender, Fuchs & Milo (2016), PLOS Biology', url: 'https://doi.org/10.1371/journal.pbio.1002533' },
  },
  {
    id: 'napoleon-height',
    topic: 'History',
    question: 'Was Napoleon unusually short?',
    answer: 'No. He was about average for a Frenchman of his time.',
    explanation:
      'Napoleon was recorded as 5 feet 2 inches in French units, but French inches were longer than English ones. In modern terms he was about 1.69 m (5 ft 7 in), roughly average.',
    more:
      'British cartoonists, especially James Gillray, loved drawing him as tiny, and he was often seen surrounded by his tall Imperial Guard. The idea of a "Napoleon complex" grew from the myth, not from his actual height.',
    related: ['Propaganda', 'Units of measurement', 'James Gillray'],
    source: { title: 'Wikipedia: Napoleon complex', url: 'https://en.wikipedia.org/wiki/Napoleon_complex' },
  },
  {
    id: 'lake-baikal',
    topic: 'Geography',
    question: 'Roughly how much of the world\'s unfrozen surface fresh water is held in one Siberian lake?',
    answer: 'Around a fifth, in Lake Baikal.',
    explanation:
      'Baikal is the deepest lake on Earth, over 1,600 m at its deepest, and holds more water than all the North American Great Lakes combined.',
    more:
      'It is also the oldest lake, around 25 million years old, and sits in an active rift where the continent is slowly pulling apart. It is home to the nerpa, one of the only freshwater seals.',
    related: ['Rift valleys', 'Endemic species', 'Fresh water'],
    source: { title: 'Wikipedia: Lake Baikal', url: 'https://en.wikipedia.org/wiki/Lake_Baikal' },
  },
  {
    id: 'birthday-paradox',
    topic: 'Science',
    question: 'How many people need to be in a room for a better than even chance that two share a birthday?',
    answer: 'Just 23.',
    explanation:
      'It feels wrong because we picture someone matching our own birthday. But with 23 people there are 253 different pairs, and each pair is a chance for a match.',
    more:
      'With 70 people the chance is over 99.9%. The same maths explains why computer systems that use random codes must make them long enough to avoid accidental "collisions".',
    related: ['Probability', 'Combinatorics', 'Hash collisions'],
    source: { title: 'Wikipedia: Birthday problem', url: 'https://en.wikipedia.org/wiki/Birthday_problem' },
  },
  {
    id: 'round-plane-windows',
    topic: 'Engineering',
    question: 'Why are aeroplane windows rounded instead of square?',
    answer: 'Because square corners concentrate stress, and that once brought down jet airliners.',
    explanation:
      'The de Havilland Comet, the first jet airliner, suffered fatal breakups in 1954. Investigators found that metal fatigue cracks grew from the corners of openings in the cabin, where stress was concentrated by repeated pressurisation.',
    more:
      'Curves spread stress evenly. After the Comet investigation, rounded windows and openings became standard, and the testing methods developed for it, including pressurising a fuselage in a water tank, shaped aviation safety.',
    related: ['Stress concentration', 'Metal fatigue', 'De Havilland Comet'],
    source: { title: 'Wikipedia: de Havilland Comet', url: 'https://en.wikipedia.org/wiki/De_Havilland_Comet#Investigation' },
  },
  {
    id: 'zeno-achilles',
    topic: 'Philosophy',
    question: 'Can a fast runner ever overtake a tortoise that has a head start?',
    answer: 'Of course, but explaining why took mathematics around two thousand years.',
    explanation:
      'Zeno of Elea argued that by the time Achilles reaches where the tortoise was, it has moved on, and so on forever, so he can never catch it. The steps get smaller each time, and an infinite series of them can add up to a finite distance and time.',
    more:
      'The rigorous idea of a limit, which settles the maths, was only developed in the 19th century. Some philosophers still debate whether it fully answers Zeno\'s question about how motion through infinitely many points is possible.',
    related: ['Infinite series', 'Limits in calculus', 'Paradoxes'],
    source: { title: 'Stanford Encyclopedia of Philosophy: Zeno\'s paradoxes', url: 'https://plato.stanford.edu/entries/paradox-zeno/' },
  },
  {
    id: 'first-website',
    topic: 'Technology',
    question: 'Can you still visit the first website ever made?',
    answer: 'Yes, at info.cern.ch.',
    explanation:
      'Tim Berners-Lee built the World Wide Web at CERN, the physics laboratory near Geneva, and the first website went live in 1991. It explained what the web was and how to make your own pages. CERN restored it in 2013.',
    more:
      'In 1993 CERN put the web\'s software into the public domain, which is a big reason it spread so widely. The web and the internet are different things: the internet is the network, and the web is one system of linked pages that runs on it.',
    related: ['Tim Berners-Lee', 'Hypertext', 'Internet vs. web'],
    source: { title: 'CERN: The birth of the web', url: 'https://home.cern/science/computing/birth-web' },
  },
  {
    id: 'tardigrades-space',
    topic: 'Biology',
    question: 'Which animal has survived being exposed to open space?',
    answer: 'The tardigrade, or "water bear".',
    explanation:
      'In 2007, dried-out tardigrades were carried into orbit on the FOTON-M3 mission and exposed to the vacuum of space. Many revived when rehydrated back on Earth, and some even survived the Sun\'s ultraviolet radiation.',
    more:
      'Tardigrades are under a millimetre long and live almost everywhere, including moss in your local park. When they dry out they curl into a dormant "tun" state and can wait for years until water returns.',
    related: ['Cryptobiosis', 'Extremophiles', 'Astrobiology'],
    source: { title: 'Wikipedia: Tardigrade', url: 'https://en.wikipedia.org/wiki/Tardigrade#Survival_in_space' },
  },
  {
    id: 'ice-floats',
    topic: 'Science',
    question: 'Why do lakes freeze from the top down rather than from the bottom up?',
    answer: 'Because water is densest at about 4 °C, and ice is lighter still.',
    explanation:
      'Most substances shrink as they cool and freeze. Water does until about 4 °C, then expands, because its molecules lock into an open hexagonal structure. Cold water and ice rise to the top, and the ice layer insulates the water beneath.',
    more:
      'If ice sank, lakes and seas could freeze solid from the bottom up, and life in them would struggle to survive winters. This odd behaviour comes from hydrogen bonding between water molecules.',
    related: ['Hydrogen bonding', 'Density', 'Ice ages'],
    source: { title: 'Wikipedia: Properties of water', url: 'https://en.wikipedia.org/wiki/Properties_of_water#Density_of_water_and_ice' },
  },
]
