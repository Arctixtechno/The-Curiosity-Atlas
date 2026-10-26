// Short, checked facts for the hall's "Did you know?" plaques. Each plaque
// shows a new one every hour of the house's clock (100 real seconds), so
// coming back later always shows something different.

export interface Fact {
  topic: string
  text: string
}

export const FACTS: Fact[] = [
  { topic: 'Animals', text: 'An octopus has three hearts, and its blood is blue: it carries oxygen with copper rather than iron.' },
  { topic: 'Space', text: 'A day on Venus, one turn on its axis, takes 243 Earth days. Its year is only 225.' },
  { topic: 'Plants', text: 'To a botanist a banana is a berry, and a strawberry is not.' },
  { topic: 'Engineering', text: "The Eiffel Tower grows by up to 15 cm in summer, as its iron expands in the heat." },
  { topic: 'Life', text: 'Sharks are older than trees: they swam the seas some 450 million years ago, well before the first forests.' },
  { topic: 'Animals', text: "Wombats leave cube-shaped droppings, the only animal known to do so." },
  { topic: 'Maths', text: 'There are more possible games of chess than there are atoms in the observable universe.' },
  { topic: 'Space', text: 'Sunlight takes about 8 minutes 20 seconds to reach us. You always see the Sun as it was.' },
  { topic: 'History', text: 'The University of Oxford was teaching by 1096, more than two centuries before the Aztecs founded Tenochtitlan.' },
  {
    topic: 'History',
    text: 'Cleopatra lived nearer in time to the Moon landing than to the building of the Great Pyramid of Giza.',
  },
  { topic: 'Physics', text: 'At its triple point, 0.01 °C under very low pressure, water can boil and freeze at the same time.' },
  { topic: 'Space', text: 'A teaspoon of neutron star would weigh about a billion tonnes.' },
  { topic: 'Animals', text: 'Tardigrades, half-millimetre "water bears", survived ten days exposed to open space in 2007.' },
  { topic: 'London', text: 'The Great Fire of London in 1666 destroyed over 13,000 houses, yet only six deaths were recorded.' },
  {
    topic: 'London',
    text: "The Natural History Museum's terracotta animals are sorted: living species on the west wing, extinct ones on the east.",
  },
  { topic: 'London', text: 'Big Ben is the great bell. The tower it hangs in has been called the Elizabeth Tower since 2012.' },
  { topic: 'London', text: "The world's first underground railway opened in London in 1863, with steam trains." },
  { topic: 'Body', text: 'Your body holds roughly as many bacteria as human cells: tens of trillions of each.' },
  { topic: 'Weather', text: 'A lightning bolt heats the air to about 30,000 °C, around five times hotter than the surface of the Sun.' },
  { topic: 'Space', text: 'Saturn is less dense than water. In a big enough bath, it would float.' },
  { topic: 'History', text: 'The shortest war on record, between Britain and Zanzibar in 1896, was over in under 45 minutes.' },
  { topic: 'Physics', text: 'Sound travels more than four times faster through water than through air.' },
  { topic: 'Body', text: 'Your brain is about 2% of your weight but uses around 20% of your energy.' },
  { topic: 'Earth', text: 'There are about three trillion trees on Earth, far more than the stars in the Milky Way.' },
  { topic: 'Animals', text: 'Emperor penguins can dive more than 500 metres deep and hold their breath for over 20 minutes.' },
  { topic: 'Space', text: 'The Moon drifts about 3.8 cm further from Earth every year.' },
  {
    topic: 'Earth',
    text: "The point on Earth furthest from its centre isn't Everest's summit but Chimborazo in Ecuador, thanks to the bulge at the equator.",
  },
  { topic: 'Animals', text: 'A group of flamingos is called a flamboyance.' },
  {
    topic: 'People',
    text: "In 1843 Ada Lovelace published what is often called the first computer program, for Babbage's Analytical Engine.",
  },
  { topic: 'People', text: 'Isaac Newton spent his last 30 years running the Royal Mint, and prosecuted forgers himself.' },
  {
    topic: 'In this house',
    text: 'The Antikythera mechanism in the Museum is over 2,000 years old: a bronze gear train that predicted eclipses.',
  },
  {
    topic: 'In this house',
    text: 'The Rosetta Stone carries one decree in three scripts: hieroglyphs, Demotic and Greek. That is how hieroglyphs were cracked.',
  },
  { topic: 'In this house', text: 'Ammonites, like the one in the Museum, lived for over 300 million years before dying out with the dinosaurs.' },
  { topic: 'Animals', text: 'Hummingbirds are the only birds that can keep flying backwards.' },
  { topic: 'Earth', text: "Earth's spin is slowing. 620 million years ago a day lasted under 22 hours." },
  { topic: 'Food', text: 'Coffee beans are the seeds of a red fruit called the coffee cherry.' },
  { topic: 'Physics', text: 'If you could fold a sheet of paper in half 42 times, it would be thick enough to reach the Moon.' },
  { topic: 'Space', text: 'Footprints left on the Moon by the Apollo astronauts should last for millions of years: there is no wind.' },
]

/** The fact for one plaque at one hour of the house's clock. Plaques are offset so neighbours never match. */
export function factFor(hourCount: number, plaque: number): Fact {
  const i = (hourCount * 7 + plaque * 13) % FACTS.length
  return FACTS[(i + FACTS.length) % FACTS.length]
}
