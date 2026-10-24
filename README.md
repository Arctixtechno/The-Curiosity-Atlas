# The Curiosity Atlas

A small world built for endless curiosity.

The Curiosity Atlas is a personal 3D space in the browser where you wander between rooms and discover things: a fountain with a daily discovery, a library of things you have saved, a theatre, an observatory, a philosophy lounge with an AI companion, and more. It is meant as a calm alternative to doomscrolling, with no streaks or targets.

The full vision is in the [master specification](docs/PROJECT_SPEC.md), and progress is tracked in the [roadmap](docs/ROADMAP.md).

## Current state: Phase 0

The project foundation is in place: a placeholder main hall you can walk around in first person, with the Discovery Fountain in the middle and doors to the future rooms. Doors don't open yet; that comes in Phase 1.

## Running it

Requires Node.js 20 or newer.

```bash
npm install
npm run dev
```

Then open the address Vite prints (usually http://localhost:5173) and click to start exploring.

| Input | Action |
| --- | --- |
| W A S D / arrow keys | Move |
| Mouse | Look around |
| Shift | Walk faster |
| Esc | Release the cursor |

Other scripts:

- `npm run build` type-checks and builds a production bundle into `dist/`
- `npm test` runs the unit tests
- `npm run preview` serves the production build

## Tech stack

React, TypeScript and Vite, with Three.js, React Three Fiber and Drei for the 3D scene. Backend, database and AI services will be added in later phases (see spec section 8).

## Project layout

```
public/            3D models, textures and audio
src/
  world/           Player, camera, room manager, collisions
  rooms/           One component per room, plus the room registry
  features/        Discoveries, philosophy, cinema, tourism, experiments, knowledge
  components/      HTML/CSS interface pieces (HUD, panels)
  services/        AI, storage and external APIs (later phases)
  hooks/           Reusable React hooks
  types/           Shared TypeScript types
docs/              Specification and roadmap
AGENTS.md          Rules for AI coding agents
```
