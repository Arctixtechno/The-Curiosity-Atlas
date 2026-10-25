// Films for the home cinema: public-domain science, space and early-cinema
// footage hosted on Wikimedia Commons. NASA footage is in the public domain
// as work of the US government; the Lumière films are long out of copyright.
// Each film streams straight from Commons, so nothing is bundled with the app.

export interface Film {
  id: string
  title: string
  year?: number
  /** Who made it. */
  by: string
  description: string
  /** The file's name on Wikimedia Commons. */
  commonsFile: string
}

export const FILMS: Film[] = [
  {
    id: 'eagle-has-landed',
    title: 'The Eagle Has Landed: The Flight of Apollo 11',
    year: 1969,
    by: 'NASA',
    description: "NASA's own documentary of the first crewed landing on the Moon, from launch to splashdown.",
    commonsFile: 'The_Eagle_Has_Landed,_The_Flight_of_Apollo_11,_1969.webm',
  },
  {
    id: 'apollo-11-moonwalk',
    title: 'Apollo 11 Moonwalk, restored',
    year: 1969,
    by: 'NASA',
    description: 'The original television pictures of Armstrong and Aldrin on the lunar surface, restored.',
    commonsFile: 'Restored_Apollo_11_Moonwalk_-_Original_NASA_EVA_Mission_Video_-_Walking_on_the_Moon.webm',
  },
  {
    id: 'nasa-eye-view',
    title: 'A NASA Eye View of Our Earth',
    by: 'NASA',
    description: 'Our planet as seen by NASA satellites and astronauts.',
    commonsFile: 'A_NASA_Eye_View_of_Our_Earth.webm',
  },
  {
    id: 'seeing-earth',
    title: 'Seeing Earth as Only NASA Can',
    by: 'NASA',
    description: 'Unique views of our home planet gathered over more than sixty years of NASA missions.',
    commonsFile:
      'NASA_missions_have_shared_unique_views_of_our_home_planet_for_more_than_60_years_(Seeing_Earth_as_Only_NASA_Can).webm',
  },
  {
    id: 'arrivee-train',
    title: "L'Arrivée d'un train en gare de La Ciotat",
    year: 1896,
    by: 'Auguste and Louis Lumière',
    description: 'A steam train pulls into a seaside station: one of the most famous films of the first year of cinema.',
    commonsFile: "L'Arrivée_d'un_train_en_gare_de_La_Ciotat,_Complete.webm",
  },
  {
    id: 'peche-poissons-rouges',
    title: 'La Pêche aux poissons rouges',
    year: 1895,
    by: 'Louis Lumière',
    description: 'A toddler fishes for goldfish in a bowl, filmed in the very first year of cinema.',
    commonsFile: 'La_Pêche_aux_poissons_rouges_(1895).webm',
  },
  {
    id: 'arrivee-voiture',
    title: 'Arrivée en voiture',
    year: 1896,
    by: 'Louis Lumière',
    description: 'A short Lumière actuality from 1896, a glimpse of everyday life at the dawn of film.',
    commonsFile: 'Arrivée_en_voiture_(1896)_-_Louis_Lumière.webm',
  },
]

/** The file itself, via Commons' redirect to the original upload. */
export function filmUrl(film: Film) {
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(film.commonsFile)}`
}

/** The file's page on Commons, with its licence and full details. */
export function filmPage(film: Film) {
  return `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(film.commonsFile)}`
}
