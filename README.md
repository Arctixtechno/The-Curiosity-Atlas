# The Curiosity Atlas

A small world built for endless curiosity.

The Curiosity Atlas is a personal 3D space in the browser where you wander between rooms and discover things: a fountain with a daily discovery, a library of things you have saved, a theatre, an observatory, a philosophy lounge with an AI companion, and more. It is meant as a calm alternative to doomscrolling, with no streaks or targets.

The full vision is in the [master specification](docs/PROJECT_SPEC.md), and progress is tracked in the [roadmap](docs/ROADMAP.md).

## Current state: Phase 1

You start in the main hall, with the Discovery Fountain in the middle. The theatre, the observatory and the courtyard open with <kbd>E</kbd>, and each door brings you back to where you left. The courtyard sits in front of a white stucco townhouse with a columned porch, with the café's outside at the far end. The library, laboratory, philosophy lounge and café doors are there but locked until later phases. All rooms are placeholder geometry with textures drawn in code, so there are no image files to download. Floors and walls get a texture painted for their exact size, so patterns don't repeat. Walking has a gentle head bob in step with your footsteps, which turns off if your system is set to reduce motion.

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
| ` | Show room loading states |

Other scripts:

- `npm run dev` starts the development server with live reloading
- `npm run build` type-checks and builds a production bundle into `dist/`
- `npm test` runs the unit tests
- `npm run preview` serves the production build

## Tech stack

React, TypeScript and Vite, with Three.js, React Three Fiber and Drei for the 3D scene. Backend, database and AI services will be added in later phases (see spec section 8).

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
