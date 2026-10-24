# Roadmap

Taken from section 11 of the [master specification](./PROJECT_SPEC.md). The earliest priority is a working 3D environment, not every AI feature at once. Development priority: depth before breadth.

Status key: ✅ done · 🚧 in progress · ⬜ not started

## Phase 0 — Project Foundation 🚧

Objective: establish the development environment.

- ✅ Initialise a React and TypeScript project using Vite
- ✅ Install Three.js and React Three Fiber
- ✅ Establish the project directory structure
- ✅ Initialise Git and create a private GitHub repository
- ✅ Configure local development
- ✅ Create an initial 3D scene
- ✅ Establish basic camera controls

Deliverable: a website that loads an interactive 3D environment.

## Phase 1 — Prototype 0.0.1: Explorable Property ⬜

Objective: demonstrate the core spatial experience.

Required environments: main hallway, theatre, observatory, small courtyard, exterior representation of the café. Placeholder geometry is fine.

Functional requirements:

- First-person movement
- Mouse-controlled camera
- Basic collisions
- Interactive doors
- Room transitions
- Dynamic room loading
- Basic lighting
- Simple interaction prompts
- Working navigation between environments

Acceptance criteria:

- The user can navigate the environment
- Doors function consistently
- Rooms load when needed
- Exiting a room returns the user to the correct location
- The application remains stable during repeated transitions
- Unnecessary interior models are not all rendered simultaneously

Deliverable: a playable website where the user can move through the property, open doors and enter individually loaded rooms. This is also the first milestone in spec section 17.

## Phase 2 — Prototype 0.1: Core Curiosity Experience ⬜

Objective: make the application genuinely useful.

- Discovery Fountain: present and explain curated daily discoveries
- Philosophy Lounge: natural AI conversations through a simple text interface
- Library of Discoveries: save and revisit discoveries
- Basic Curator: AI explanations and conversations through a secure backend
- Persistent local storage or a simple database
- Basic interface transitions and navigation between the central features
- Error handling for AI requests, loading and connection indicators

Deliverable: a user can discover something, discuss it with AI and save it for later.

## Phase 3 — Prototype 0.2: Media and Exploration ⬜

- Functional theatre video player
- AI-curated video recommendations
- Saved watchlist
- Basic City Explorer with London neighbourhood discovery
- Simple itinerary generation using verified geographical information
- Improved library organisation

Deliverable: users can discover information, watch relevant content and plan real-world experiences.

## Phase 4 — Version 0.3: Interactive Environments ⬜

First functional versions of the observatory, museum, experimental laboratory, workshop and outdoor café, each with a small number of high-quality interactions (for example, two validated lab simulations rather than dozens of incomplete ones).

## Phase 5 — Private Beta ⬜

Improve navigation, visuals, performance, accessibility and reliability; evaluate AI costs; add accounts where necessary; gather feedback from a small group of testers. The central question: do people enjoy it enough to return voluntarily?

## Phase 6 — Future Development ⬜

Possible additions, not required for the first release: voice conversations, animated AI companions, advanced experiments, historical experiences, multiplayer visits, shared video sessions, more rooms, customisable interiors, expanded city exploration, mobile companion, community-created experiences.
