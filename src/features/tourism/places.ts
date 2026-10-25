import type { LatLng } from './geo.ts'

// London neighbourhoods and places for the City Explorer. Coordinates and
// facts come from each place's source page (mostly Wikipedia), checked when
// this list was written. Opening hours and prices change, so they're left
// out: follow the source link before you go.

export type PlaceKind = 'museum' | 'gallery' | 'garden' | 'landmark' | 'street' | 'church' | 'music' | 'sport'

export interface Place {
  id: string
  name: string
  at: LatLng
  kind: PlaceKind
  /** A suggested visit length, in minutes, used by the walk planner. */
  visitMinutes: number
  description: string
  /** Where the facts and coordinates came from. */
  source: string
  /** Quieter places that are easy to walk past. */
  hiddenGem?: boolean
}

export interface Neighbourhood {
  id: string
  name: string
  centre: LatLng
  blurb: string
  places: Place[]
}

const wiki = (title: string) => `https://en.wikipedia.org/wiki/${title}`

export const NEIGHBOURHOODS: Neighbourhood[] = [
  {
    id: 'marylebone',
    name: 'Marylebone',
    centre: [51.5197, -0.1525],
    blurb:
      'A village feel north of Oxford Street: a long high street of small shops, Georgian squares and a great free collection.',
    places: [
      {
        id: 'wallace-collection',
        name: 'Wallace Collection',
        at: [51.5175, -0.153],
        kind: 'gallery',
        visitMinutes: 75,
        description:
          'Paintings, armour and furniture in Hertford House, a town house that first opened as a museum on 22 June 1900. Entry is free.',
        source: wiki('Wallace_Collection'),
        hiddenGem: true,
      },
      {
        id: 'marylebone-high-street',
        name: 'Marylebone High Street',
        at: [51.5197, -0.1517],
        kind: 'street',
        visitMinutes: 30,
        description: 'Voted Best Street in London by BBC Radio 4 listeners in 2002. Most of its buildings date from about 1900.',
        source: wiki('Marylebone_High_Street'),
      },
      {
        id: 'st-marylebone-church',
        name: 'St Marylebone Parish Church',
        at: [51.5227, -0.1523],
        kind: 'church',
        visitMinutes: 20,
        description: "Thomas Hardwick's Grade I listed church, built 1813 to 1817, at the top of the high street.",
        source: wiki('St_Marylebone_Parish_Church'),
        hiddenGem: true,
      },
    ],
  },
  {
    id: 'baker-street',
    name: 'Baker Street',
    centre: [51.5228, -0.1578],
    blurb: "Sherlock Holmes's street, and one of the oldest underground stations in the world.",
    places: [
      {
        id: 'sherlock-holmes-museum',
        name: 'Sherlock Holmes Museum',
        at: [51.5237, -0.1585],
        kind: 'museum',
        visitMinutes: 45,
        description:
          "Opened in 1990 as the world's first museum dedicated to the fictional detective, in a Georgian house built in 1815.",
        source: wiki('Sherlock_Holmes_Museum'),
      },
      {
        id: 'baker-street-station',
        name: 'Baker Street station',
        at: [51.522, -0.157],
        kind: 'landmark',
        visitMinutes: 10,
        description:
          'Opened on 10 January 1863 on the Metropolitan Railway, the first underground line. The old platforms are Grade II* listed.',
        source: wiki('Baker_Street_tube_station'),
        hiddenGem: true,
      },
    ],
  },
  {
    id: 'chelsea',
    name: 'Chelsea',
    centre: [51.4866, -0.1625],
    blurb: 'Riverside streets with a 17th-century garden, a veterans’ hospital by Wren, and a free contemporary gallery.',
    places: [
      {
        id: 'chelsea-physic-garden',
        name: 'Chelsea Physic Garden',
        at: [51.485, -0.1628],
        kind: 'garden',
        visitMinutes: 60,
        description: "Founded in 1673 as the Apothecaries' Garden, for growing medicinal plants. It is Grade I listed.",
        source: wiki('Chelsea_Physic_Garden'),
        hiddenGem: true,
      },
      {
        id: 'royal-hospital-chelsea',
        name: 'Royal Hospital Chelsea',
        at: [51.4864, -0.1578],
        kind: 'landmark',
        visitMinutes: 45,
        description:
          'Founded by Charles II in 1682 as a home for veterans, the Chelsea Pensioners. Its chapel, by Christopher Wren, was finished in 1687.',
        source: wiki('Royal_Hospital_Chelsea'),
      },
      {
        id: 'saatchi-gallery',
        name: 'Saatchi Gallery',
        at: [51.4906, -0.1589],
        kind: 'gallery',
        visitMinutes: 60,
        description: "Contemporary art in the Duke of York's Headquarters on the King's Road, where it reopened in October 2008.",
        source: wiki('Saatchi_Gallery'),
      },
      {
        id: 'carlyles-house',
        name: "Carlyles' House",
        at: [51.4842, -0.1698],
        kind: 'museum',
        visitMinutes: 40,
        description: 'The 1708 house at 5 Cheyne Row where Thomas and Jane Carlyle lived from 1834, kept much as they left it.',
        source: wiki("The_Carlyles'_House"),
        hiddenGem: true,
      },
    ],
  },
  {
    id: 'fulham',
    name: 'Fulham',
    centre: [51.4745, -0.2195],
    blurb: 'A bend of the Thames with a bishops’ palace, a riverside park and the home ground of Fulham FC.',
    places: [
      {
        id: 'fulham-palace',
        name: "Fulham Palace and Bishop's Park",
        at: [51.4706, -0.2161],
        kind: 'garden',
        visitMinutes: 60,
        description:
          "Home of the Bishops of London from the 11th century until 1973, with its gardens beside Bishop's Park, opened in 1893.",
        source: wiki('Fulham_Palace'),
        hiddenGem: true,
      },
      {
        id: 'craven-cottage',
        name: 'Craven Cottage',
        at: [51.4839, -0.2242],
        kind: 'sport',
        visitMinutes: 20,
        description: "Fulham FC's riverside ground since 1896, with a stand by the architect Archibald Leitch.",
        source: wiki('Craven_Cottage'),
      },
    ],
  },
  {
    id: 'south-kensington',
    name: 'South Kensington',
    centre: [51.4985, -0.1755],
    blurb: 'The museum quarter built after the Great Exhibition: three great free museums within a few minutes of each other.',
    places: [
      {
        id: 'natural-history-museum',
        name: 'Natural History Museum',
        at: [51.4961, -0.1764],
        kind: 'museum',
        visitMinutes: 120,
        description: "Alfred Waterhouse's terracotta cathedral to nature, opened on 18 April 1881. Entry is free.",
        source: wiki('Natural_History_Museum,_London'),
      },
      {
        id: 'science-museum',
        name: 'Science Museum',
        at: [51.4975, -0.1747],
        kind: 'museum',
        visitMinutes: 120,
        description:
          'Founded in 1857 as part of the South Kensington Museum; its present building opened in stages from 1919 to 1928.',
        source: wiki('Science_Museum,_London'),
      },
      {
        id: 'v-and-a',
        name: 'Victoria and Albert Museum',
        at: [51.4967, -0.1719],
        kind: 'museum',
        visitMinutes: 120,
        description:
          'Art and design from every age, opened by Queen Victoria in 1857. Aston Webb designed the Cromwell Road front.',
        source: wiki('Victoria_and_Albert_Museum'),
      },
      {
        id: 'royal-albert-hall',
        name: 'Royal Albert Hall',
        at: [51.5009, -0.1775],
        kind: 'music',
        visitMinutes: 20,
        description: 'The great round concert hall, opened by Queen Victoria on 29 March 1871 and home of the Proms.',
        source: wiki('Royal_Albert_Hall'),
      },
      {
        id: 'albert-memorial',
        name: 'Albert Memorial',
        at: [51.5024, -0.1777],
        kind: 'landmark',
        visitMinutes: 15,
        description: "George Gilbert Scott's gilded memorial to Prince Albert in Kensington Gardens, opened in 1872.",
        source: wiki('Albert_Memorial'),
      },
    ],
  },
  {
    id: 'bloomsbury',
    name: 'Bloomsbury',
    centre: [51.5214, -0.1229],
    blurb: 'Leafy squares, the university and the British Museum, with Dickens’s first family home round the corner.',
    places: [
      {
        id: 'british-museum',
        name: 'British Museum',
        at: [51.5188, -0.1262],
        kind: 'museum',
        visitMinutes: 120,
        description: 'Established in 1753 and opened in 1759, the first national public museum. Entry is free.',
        source: wiki('British_Museum'),
      },
      {
        id: 'russell-square',
        name: 'Russell Square',
        at: [51.5217, -0.1261],
        kind: 'garden',
        visitMinutes: 20,
        description: "Laid out in 1804 and restored in 2002 to a plan based on Humphry Repton's original.",
        source: wiki('Russell_Square'),
      },
      {
        id: 'charles-dickens-museum',
        name: 'Charles Dickens Museum',
        at: [51.5236, -0.1163],
        kind: 'museum',
        visitMinutes: 60,
        description:
          'At 48 Doughty Street, where Dickens lived from 1837 to 1839 and wrote Oliver Twist. The museum opened in 1925.',
        source: wiki('Charles_Dickens_Museum'),
        hiddenGem: true,
      },
    ],
  },
]

export const ALL_PLACES: Place[] = NEIGHBOURHOODS.flatMap((n) => n.places)

export function findPlace(id: string) {
  return ALL_PLACES.find((p) => p.id === id)
}
