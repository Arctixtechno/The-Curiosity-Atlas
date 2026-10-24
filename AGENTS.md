# Agent guidelines

Instructions for AI coding agents working on The Curiosity Atlas. Read this before making changes.

## Source of truth

- [`docs/PROJECT_SPEC.md`](docs/PROJECT_SPEC.md) is the master specification. Follow it.
- [`docs/ROADMAP.md`](docs/ROADMAP.md) says which phase we are in. Work on the current phase unless asked otherwise, and tick items off when they are done.

## Development rules (spec section 10)

AI agents should:

- Follow the master specification.
- Preserve existing functionality unless changes are requested.
- Reuse established components where practical.
- Avoid unnecessary dependencies.
- Keep features modular.
- Add or update tests for important logic.
- Document significant architectural changes.
- Avoid exposing credentials or private information.

AI agents may modify the project when given appropriate access and instructions, but updates should not occur autonomously without an authorised development workflow. Work on a branch and open a pull request; changes are reviewed before they are merged into `main`.

## Workflow

1. Define the feature: intended behaviour, design requirements, constraints.
2. Review the existing architecture and conventions in the files you will touch.
3. Implement it in the appropriate module.
4. Test: run `npm run build` and `npm test`, and check the feature in the running app (`npm run dev`).
5. Open a pull request for review.

## Architecture

Keep three concerns separate (spec section 8.2):

- **Environment system**: `src/world/` (player, camera, room manager, doors, interactions) and `src/rooms/` (one component per room, registered in `src/rooms/registry.ts`).

## Adding a room

1. Add its sizes to `src/rooms/dimensions.ts`.
2. Create `src/rooms/<Room>.tsx` with a **default export** (it is loaded with `import()` so it gets its own chunk). Use `RoomShell` for walls and `Atmosphere` for background and fog.
3. Register it in `src/rooms/registry.ts` with its colliders, doors and `load`. Every open door needs a matching door in the target room that leads back; `npm test` checks this.
4. Anything the player can use gets `useInteractable` from `src/world/InteractionSystem.tsx`, so prompts and the E key behave the same everywhere.
- **Feature system**: `src/features/<feature>/` for discoveries, philosophy, cinema, tourism, experiments and knowledge.
- **Service system**: `src/services/` for AI requests, storage, external APIs and auth.

Shared HTML/CSS interface pieces go in `src/components/`, reusable hooks in `src/hooks/`, shared types in `src/types/`. Static 3D models, textures and audio go in `public/`.

Text-heavy interfaces use ordinary HTML and CSS layered over the canvas, not 3D text.

## Constraints

- No paid service until a specific feature needs it.
- AI API keys live on a server, never in client-side code or the repo.
- Simulations and other deterministic logic use real code, not AI output (spec sections 5.7 and 6.4).
