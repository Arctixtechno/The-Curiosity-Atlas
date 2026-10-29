# The Curiosity Atlas

A small world built for endless curiosity.

The Curiosity Atlas is a personal 3D space in the browser where you wander between rooms and discover things: a fountain with a daily discovery, a library of things you have saved, a theatre, an observatory, a philosophy lounge with an AI companion, and more. It is meant as a calm alternative to doomscrolling, with no streaks or targets.

The full vision is in the [master specification](docs/PROJECT_SPEC.md), and progress is tracked in the [roadmap](docs/ROADMAP.md).

## Current state: Phase 1, with the first part of Phase 3

You start in the main hall, with the Discovery Fountain in the middle. The theatre, the observatory, the laboratory, the museum, the courtyard and the café open with <kbd>E</kbd>, and each door brings you back to where you left. The courtyard sits in front of a white stucco townhouse with a columned porch, with the café at the far end. The library and philosophy lounge doors are there but locked until later phases. All rooms are placeholder geometry with textures drawn in code, so there are no image files to download. Floors and walls get a texture painted for their exact size, so patterns don't repeat. Walking has a gentle head bob in step with your footsteps, which you can turn off in Settings (it starts off if your system is set to reduce motion).

In the theatre, press <kbd>E</kbd> at the lectern on the landing (or facing the screen) to choose a film: public-domain NASA and Lumière films stream from Wikimedia Commons onto the big screen, or you can play a video file from your own computer. The lights dim while a film plays, and a watchlist remembers films you save. In the laboratory, two benches open live experiments: a gas in a cylinder under a piston (change its volume, temperature and amount, and watch the pressure follow the ideal gas law) and a tank where one-litre blocks of cork, ice, steel or gold float or sink in water, oil, glycerol or mercury. Both are calculated from standard physics, not made up by AI. In the observatory, press <kbd>E</kbd> at the telescope to look through it at the moon and a night sky that is different every visit, or at the orrery to see the planets where they really are on any date from 1800 to 2050 (from JPL's orbital elements), with NASA's figures for each. Through a door in the laboratory, the workshop has a gear bench (build a train of up to three stages and see speed and torque trade off) and a circuit bench (bulbs and resistors in series or parallel, solved with Ohm's law). In the Museum of Everything, six exhibits (the Rosetta Stone, the Gibeon meteorite, an astrolabe, Harrison's H4 chronometer, an ammonite and the Antikythera mechanism) each open a panel with a model you can turn over and a label drawn from Wikipedia. In the café, the counter lets you make espresso drinks (pull shots, steam milk, add foam or water) and tells you which drink you've made, checked against recipes from Wikipedia's coffee pages. A car parked in the courtyard drives you out to Marshgate Refinery on the Thames estuary (the drive plays while the site loads; <kbd>Space</kbd> skips it). There you can read the site board, which explains every unit in a refinery and how the streams connect, and run the crude distillation unit from the panel at the foot of its column or from the control room: choose the crude, set the furnace's temperature controller in automatic or manual, move the column's draws and stripping steam, and watch the cut points, product specs, sulphur and margin respond, with a live process flow diagram, trends, alarms and shift tasks to complete. Downstream, the vacuum unit and cat cracker share a screen: set the vacuum's pressure and heat to choose how deep to cut into the residue, then run the cracker's riser, feed preheat and catalyst cooler against its heat balance and its regenerator, air blower and gas compressor limits. The reformer screen takes the crude unit's naphtha through a hydrotreater (keep its sulphur off the platinum) and three reactors with a furnace before each: trade octane against yield and hydrogen, watch the temperature drop through each reactor, and run the catalyst on for months as coke builds up, raising the temperatures to hold the octane until it has to be regenerated. On the hydrotreating plot, make 10 ppm road diesel (harder once the cat cracker's cycle oil goes in), balance the hydrogen the reformer makes against what the hydrotreaters use, and trim the sulphur plant's air to 2:1 to keep the stack inside its SO₂ permit. East of the crude column, the light ends screen sets the depropaniser's reflux against its reboiler, finds the isomerisation reactor's best temperature where equilibrium meets reaction rate, and runs the alkylation unit's acid and isobutane; at the blend header by the gate, mix every unit's streams into Premium 95, Super 98 or road diesel, summer or winter, against each spec, and compare your recipe with a linear-programming planner's. The yields come from each crude's boiling curve, not from AI; [docs/REFINERY.md](docs/REFINERY.md) has the model and the plan for the units still to come. In the main hall, the map table opens the City Explorer: a London map (OpenStreetMap) with seven neighbourhood guides, places you can filter by group (culture, outdoors, shopping, food and drink), each linked to its source, a walk planner with estimated times, and a Discovery Passport where you mark places visited or favourite and keep notes (all saved in your browser). <kbd>M</kbd> opens a map of the house and <kbd>O</kbd> opens Settings.

Each room's interior is its own code-split chunk. It starts downloading when you walk up to its door, is mounted only while you are inside, and is unmounted (freeing its geometry and materials) when you leave. Press <kbd>`</kbd> to see the Room Manager's view of every room's state.

## Running it

Requires Node.js 20 or newer.

```bash
npm install
npm run play
```

This builds the optimised version and opens it in your browser (usually at http://localhost:4173). Click to start exploring.

`npm run dev` also works and reloads as code changes, but it runs React's development checks, so it is noticeably slower. Use `npm run play` to judge how smooth it feels.

| Input | Action |
| --- | --- |
| W A S D | Move |
| Mouse or arrow keys | Look around |
| E | Open a door or interact |
| Shift | Walk faster |
| [ and ] | Lower or raise mouse sensitivity (remembered between visits) |
| Q | Release the cursor |
| Esc | Also releases the cursor, but the browser uses it to leave full screen too |
| M | Map of the house |
| O | Settings (graphics quality, field of view, sensitivity, head bob, volume) |
| P , . | In the theatre: pause, skip back and forward ten seconds |
| ` | Show room loading states |

Other scripts:

- `npm run dev` starts the development server with live reloading
- `npm run build` type-checks and builds a production bundle into `dist/`
- `npm test` runs the unit tests
- `npm run preview` serves the production build

## Tech stack

React, TypeScript and Vite, with Three.js, React Three Fiber and Drei for the 3D scene, and Leaflet with OpenStreetMap tiles for the City Explorer map. Backend, database and AI services will be added in later phases (see spec section 8).

## Project layout

```
public/            3D models, textures and audio
src/
  world/           Player, camera, room manager, doors, interactions, collisions
  rooms/           One lazily loaded component per room, the room registry and shared dimensions
  features/        Discoveries, philosophy, cinema, tourism, experiments, knowledge
  components/      HTML/CSS interface pieces (HUD, panels)
  services/        AI, storage and external APIs (later phases)
  hooks/           Reusable React hooks
  types/           Shared TypeScript types
docs/              Specification and roadmap
AGENTS.md          Rules for AI coding agents
```

## Sharing it online

`.github/workflows/pages.yml` builds the site and publishes it to GitHub Pages whenever `main` changes, so friends can visit by link. Turn it on once under the repository's **Settings → Pages → Build and deployment → Source: GitHub Actions**. Free GitHub Pages needs a public repository. Everything saved (passport, watchlist, settings) stays in each visitor's own browser.
