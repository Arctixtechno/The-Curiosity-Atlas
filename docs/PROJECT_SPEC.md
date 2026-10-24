# THE CURIOSITY ATLAS

**Master Product & Technical Specification**

- Version: 1.0
- Status: Initial specification finalised — ready for prototyping
- Project type: AI-powered interactive 3D web application
- Initial platform: Desktop web browser
- Development approach: Modular, incremental and AI-assisted
- Project name: The Curiosity Atlas

---

## 1. Executive Summary

The Curiosity Atlas is an immersive, AI-powered virtual environment designed to encourage curiosity, exploration, learning, reflection and entertainment.

The application offers an alternative to passive consumption of social media by giving users a beautiful, interactive virtual home in which they can discover new information, engage with intelligent companions, watch videos, explore real-world destinations, experiment with scientific concepts and develop their interests.

Unlike conventional educational platforms, The Curiosity Atlas will not revolve around compulsory courses, productivity targets or repetitive exercises.

Instead, it will provide a relaxing environment where users naturally discover things that interest them.

### Central concept

A personal 3D world for curiosity, exploration, learning and entertainment.

Users enter a small virtual property consisting of several rooms and outdoor spaces. Each room provides a different experience through interactive objects and AI-powered features.

The environment itself remains relatively compact, but the experiences available within it can expand considerably.

For example:

- A telescope provides access to an interactive astronomy experience.
- A theatre contains a personal AI-curated video player.
- A library stores discoveries and provides access to information.
- A laboratory allows users to perform scientific experiments.
- A philosophy lounge offers thoughtful conversations with AI companions.
- A wall map provides an intelligent guide to real-world destinations.
- A fountain introduces a new discovery every day.

The application combines the atmosphere of a game with the usefulness of AI, without requiring users to approach it as either a conventional game or an educational programme.

### Primary objective

Create an environment that users voluntarily return to because they enjoy discovering things, rather than because they are encouraged to maintain streaks, collect points or endlessly consume recommendations.

---

## 2. Product Philosophy

The Curiosity Atlas will be developed according to six principles.

### 2.1 Curiosity over productivity

The application should feel like leisure, rather than work.

Users should be able to enter without any particular objective and discover something interesting.

There should be no expectation that users complete lessons, meet daily targets or follow a predetermined learning path.

### 2.2 Exploration through interaction

Information should be presented through interactive objects, environments and experiences wherever practical.

Rather than clicking a button labelled “Astronomy”, users might approach a telescope.

Rather than opening a conventional chatbot, users might sit in a chair opposite an AI philosophical companion.

The experience should make learning and discovery feel natural.

### 2.3 Meaningful entertainment

The application should offer an alternative to doomscrolling without attempting to reproduce the addictive characteristics of modern social media.

Features should reward curiosity rather than time spent.

A meaningful five-minute visit should be considered as successful as an hour-long session.

### 2.4 Personalisation without restriction

The AI should learn which subjects interest users, with their permission.

However, it should also introduce unfamiliar subjects and unexpected discoveries.

The objective is to broaden curiosity, not create another algorithmic echo chamber.

### 2.5 A compact but expandable environment

The initial property should be small enough to develop realistically.

New features should be incorporated into existing rooms or added through modular environments.

The application does not require a vast open world.

### 2.6 AI as a partner in exploration

AI should support thinking, questioning and discovering rather than simply produce answers.

It should explain, challenge, compare perspectives, suggest further exploration and acknowledge uncertainty.

The goal is to develop a more thoughtful and interesting relationship between users and intelligent software.

---

## 3. The Virtual Environment

### 3.1 General Architecture

The Curiosity Atlas will consist of a small, interconnected property with several distinct rooms and a limited outdoor area.

Each environment will have its own visual identity, atmosphere and functionality.

The initial environment will be designed around a main hallway or central living area from which users can access the different rooms.

#### Conceptual layout

```
                   THE CURIOSITY ATLAS
                       [OBSERVATORY]
                             |
                         [LIBRARY]
                             |
       [LABORATORY] — [MAIN HALL] — [THEATRE]
                             |
                    [PHILOSOPHY LOUNGE]
                             |
                         [ENTRANCE]
                             |
                     [SMALL COURTYARD]
                             |
                          [CAFÉ]
```

This layout is conceptual and may be adjusted during 3D development.

It does not represent a requirement to construct every room immediately.

### 3.2 Visual Direction

The architectural style will be warm, atmospheric and inviting.

The intended aesthetic combines:

- Comfortable contemporary interiors.
- Traditional libraries and study rooms.
- Natural materials, including wood and stone.
- Warm lighting and soft shadows.
- Carefully designed furniture and objects.
- Subtle atmospheric sound.
- Small details that encourage exploration.

Each room should have a distinct character.

The theatre might feature dark walls, subdued lighting and comfortable seating.

The library could contain tall bookshelves, warm desk lamps and reading tables.

The observatory could feature a domed ceiling, astronomical instruments and a view of the night sky.

The café could be situated in a peaceful outdoor courtyard.

The visual experience should remain sophisticated and relaxing rather than excessively cartoonish or futuristic.

### 3.3 Inspiration

An important technical and experiential reference is Keith Clark’s browser-based CSS 3D FPS demonstration.

The project demonstrates how an explorable three-dimensional environment can be constructed using ordinary web technologies.

The Curiosity Atlas will take inspiration from its first-person navigation and use of web technology, without necessarily reproducing the CSS-based rendering implementation.

The recommended approach is to use Three.js for rendering while retaining conventional HTML and CSS for text-heavy interfaces and application controls.

### 3.4 Player Navigation

The initial application will use first-person navigation.

Desktop controls:

| Input | Function |
| --- | --- |
| W, A, S, D | Move through the environment |
| Mouse | Look around |
| E | Interact with an object |
| Escape | Release cursor or close an interaction |
| Mouse click | Select interface elements |
| Shortcut menu | Access major features directly |

The initial version will support basic collision detection to prevent the user from walking through walls and objects.

An optional third-person perspective may be introduced later.

### 3.5 Interaction Design

The environment will contain identifiable interactive objects.

When users approach an object, a subtle prompt appears.

Examples include:

> Press E to open the door.
>
> Press E to sit down.
>
> Press E to use the telescope.
>
> Press E to discover today’s fact.

Interacting with an object may trigger an animation, open an interface, begin a conversation or transition into another environment.

Interactions should be simple, responsive and consistent throughout the property.

---

## 4. Dynamic Room Loading

### 4.1 Purpose

The application will use a modular loading system to reduce unnecessary rendering and memory usage.

Rooms that users are not currently occupying should not require their complete interior models, furniture, lighting and interactive systems to remain active.

Instead, distant rooms may be represented by lightweight exterior models.

### 4.2 Loading Procedure

Each room will support four general states.

| State | Behaviour |
| --- | --- |
| Exterior | Only the lightweight exterior representation is available |
| Preloading | Required interior assets begin loading |
| Active | The interior and its interactions are available |
| Unloaded | Unnecessary interior assets and systems are released |

#### Example: Entering the observatory

1. The user approaches the observatory building.
2. The application detects proximity to the entrance.
3. The observatory’s detailed assets begin loading.
4. The user opens the entrance door.
5. The interior environment becomes active.
6. The user explores the observatory.
7. After leaving, the detailed interior can be unloaded or temporarily cached.

The transition may be seamless or include a brief camera animation.

### 4.3 Implementation

A central Room Manager will coordinate environment loading and transitions.

Individual rooms will be implemented as independent components containing their own models, interactive objects and environmental settings.

The initial system should prioritise simplicity.

More advanced optimisation, including asset caching and predictive loading, can be introduced once performance requirements are better understood.

### 4.4 Important Technical Considerations

Not rendering an object does not necessarily remove it from memory.

The Room Manager will therefore distinguish between:

- Hiding objects.
- Removing objects from the active scene.
- Loading and unloading asset data.
- Retaining reusable resources in a cache.

This will allow the application to remain responsive as additional rooms are introduced.

---

## 5. Main Features

The following sections define the intended feature set.

Features are divided into three development priorities.

- **Core:** Necessary for the initial useful application.
- **Expansion:** Implemented after the core experience is established.
- **Future:** More complex capabilities intended for later development.

### 5.1 Discovery Fountain

Priority: Core
Location: Main hall or entrance area

The Discovery Fountain will provide a daily opportunity to discover something fascinating.

It will serve as one of the primary reasons for returning to the application.

#### Functionality

Each day, the fountain presents a new fact, question or discovery.

Topics may include science, engineering, history, geography, biology, psychology, culture, philosophy and technology.

Users can:

- Reveal the daily discovery.
- Request additional explanations.
- Explore related concepts.
- View relevant illustrations or interactive demonstrations.
- Save discoveries to their library.
- Request something completely unexpected.

The feature should preferably introduce a question before revealing its explanation.

#### Content quality

Facts should be supported by reliable sources.

The initial implementation will use a curated database of reviewed discoveries rather than relying entirely on uncontrolled AI generation.

AI will primarily personalise explanations, answer follow-up questions and suggest connections.

### 5.2 Philosophy Lounge

Priority: Core
Location: Dedicated lounge

The Philosophy Lounge is an AI-powered environment for thoughtful conversations.

Users enter the lounge, sit down and engage with an AI companion.

#### Purpose

The feature encourages users to reflect on their beliefs, experiences, decisions and understanding of the world.

The AI should introduce different perspectives and provide constructive challenges rather than simply agree with the user.

#### Conversation modes

**Open Conversation**

Discuss anything on the user’s mind.

**Philosophical Discussion**

Explore questions about morality, happiness, identity, meaning, freedom and human nature.

**Different Perspectives**

Examine a subject through contrasting philosophical, cultural or intellectual viewpoints.

**Thought Experiments**

Explore hypothetical scenarios that challenge assumptions.

**Socratic Dialogue**

Use thoughtful questioning to help users examine their own reasoning.

**Personal Reflection**

Reflect on experiences, decisions and ways of thinking.

#### Additional capabilities

Conversations may produce optional notes, reading recommendations or philosophical references.

Users can save selected insights in their library.

Voice interaction and animated AI characters may be introduced later.

Private reflections will not automatically be used for recommendation personalisation without appropriate user control.

### 5.3 The Personal Theatre

Priority: Early expansion
Location: Dedicated theatre room

The theatre provides an immersive environment for watching and discovering videos.

Users can sit in a virtual cinema and watch content through a large screen.

#### Viewing modes

**Discover**

AI recommends documentaries, explainers and interesting videos according to user interests and available time.

**My Watchlist**

Users access videos they have previously saved.

**Personal Media**

Users play supported video files selected or uploaded from their own devices.

#### AI functionality

The AI curator can recommend videos, explain their relevance, and answer questions about supported content when a transcript or other suitable source is available.

Recommendations should include surprising subjects outside the user’s usual interests.

#### Technical approach

The initial implementation will support permitted video embeds, including suitable YouTube videos, and browser-supported personal media.

Unsupported streaming platforms will open in an external browser tab.

A universal embedded web browser is not required.

#### Future functionality

Users may eventually invite friends to watch videos together through synchronised viewing sessions.

Full multiplayer avatars are not necessary for the initial social implementation.

### 5.4 The Library of Discoveries

Priority: Core
Location: Dedicated library

The library acts as the user’s personal knowledge archive.

Discoveries, useful conversations, articles, videos and other interesting information can be saved here.

#### Functionality

Users can:

- Save discoveries and favourite content.
- Organise material by subject.
- Search their personal collection.
- Revisit previous discoveries.
- Read and review saved information.
- Explore connections between different subjects.

The library will provide both an immersive bookshelf interface and a conventional searchable interface.

#### Rediscovery

A future feature may occasionally recommend revisiting previous discoveries, particularly when they relate to something recently explored.

#### Long-term vision

The library gradually becomes a personal encyclopaedia reflecting the user’s intellectual interests and experiences.

### 5.5 City Explorer

Priority: Early expansion
Location: Interactive map or globe within the library

City Explorer is an AI-powered tourism and neighbourhood discovery system.

It helps users explore real places, discover interesting destinations and plan enjoyable outings.

#### Main capabilities

**Neighbourhood Discovery**

Explore areas of cities and understand their character, history, architecture and attractions.

**Personalised Itineraries**

Generate realistic walking itineraries based on location, available time, interests and budget.

**Historical Context**

Learn about streets, buildings, monuments and other places of interest.

**Hidden Gems**

Discover less familiar places beyond conventional tourist attractions.

**Discovery Passport**

Save destinations visited, favourite locations, photographs and notes.

#### Initial location

London will be the first supported city.

The application should support destinations such as Marylebone, Chelsea, Fulham, Baker Street and other neighbourhoods.

#### Technical requirements

The feature must use reliable mapping and place information.

AI will interpret user preferences and organise itineraries, while suitable external data sources will supply geographical information and routes.

Current opening hours, prices and availability must be verified rather than invented.

### 5.6 Museum of Everything

Priority: Expansion
Location: Gallery or museum room

The museum is an interactive collection of fascinating objects and exhibitions.

Exhibitions may cover historical artefacts, scientific instruments, natural history, engineering, inventions and unusual discoveries.

Users should be able to inspect selected objects, rotate supported 3D models and explore accompanying explanations.

The initial museum will contain a small collection of carefully selected exhibits.

Additional exhibitions can be introduced over time.

### 5.7 Experimental Laboratory

Priority: Expansion
Location: Dedicated laboratory

The Experimental Laboratory provides interactive scientific demonstrations and experiments.

Initial topics may include:

- Pressure and fluid behaviour.
- Density and buoyancy.
- Heat transfer.
- Gas laws.
- Chemical reaction rates.
- Basic electrical circuits.
- Mechanical forces.

The long-term objective is to support more advanced scientific and engineering concepts.

#### Important design principle

The AI should explain scientific concepts and guide experimentation.

The simulations themselves should use validated mathematical models and predictable program logic.

AI-generated explanations must not substitute for accurate physics or chemical calculations.

### 5.8 Observatory

Priority: Expansion
Location: Dedicated observatory room

The observatory provides an interactive environment for exploring astronomy.

Users can interact with a telescope or astronomical display.

#### Proposed features

- Interactive solar system.
- Planetary comparisons.
- Orbital demonstrations.
- Astronomy facts.
- Guided exploration.
- Celestial objects and their characteristics.

The initial observatory will focus on visual exploration and simple interactions.

More advanced astronomical experiences can follow.

### 5.9 Workshop

Priority: Expansion
Location: Workshop room or laboratory extension

The Workshop provides interactive experiences focused on practical skills, creativity and mechanical understanding.

Examples include:

- Mechanical assemblies.
- Engines and machinery.
- Electrical circuits.
- Engineering components.
- Design and construction.
- Coffee extraction.
- Basic tailoring concepts.

The Workshop should grow through individual, carefully designed modules.

It is not intended to become a universal simulation system immediately.

### 5.10 The Café

Priority: Expansion
Location: Outdoor courtyard

The café provides a relaxing space for informal AI interactions.

Unlike the Philosophy Lounge, conversations here are intended to be casual and open-ended.

Users might:

- Discuss an interesting topic.
- Practise a language.
- Receive reading recommendations.
- Talk about hobbies.
- Explore cultural subjects.
- Engage with an AI conversational companion.

The café may eventually support simple interactive drink-making activities.

It could also become an attractive location for future social features.

### 5.11 Time Portal

Priority: Future
Location: Special doorway or themed room

The Time Portal allows users to explore historical periods through interactive experiences.

Initially, these could be illustrated stories, timelines, maps and artefact collections.

Future development may include explorable historical reconstructions.

Historical experiences must distinguish established evidence from artistic reconstruction.

### 5.12 The Mystery Door

Priority: Expansion
Location: Main property

The Mystery Door presents a surprise experience.

It might reveal:

- A scientific puzzle.
- A historical mystery.
- An unusual discovery.
- A miniature interactive experiment.
- A thought-provoking question.

The purpose is to encourage spontaneous curiosity and introduce users to unexpected subjects.

Ideally, the feature will reuse content and interactions already developed for other parts of the application.

---

## 6. The Central AI System

### 6.1 General Architecture

The Curiosity Atlas will use a central AI orchestration system referred to as The Curator.

Rather than developing completely separate intelligence systems for every room, The Curator will provide shared capabilities across the application.

Each room will supply its own context, instructions and available tools.

For example, the same underlying AI service may act as:

- A philosophical companion in the lounge.
- A video curator in the theatre.
- A tourism guide in the library.
- A scientific assistant in the laboratory.
- An astronomy guide in the observatory.

This approach reduces duplicated infrastructure while allowing each experience to feel distinct.

### 6.2 Responsibilities

The Curator will be responsible for:

**Discovery**

Selecting and explaining interesting information.

**Personalisation**

Understanding declared interests and permitted preference information.

**Recommendations**

Suggesting relevant videos, experiences and subjects.

**Conversation**

Supporting natural discussions and answering questions.

**Contextual Assistance**

Understanding which room, object or activity the user is interacting with.

**Knowledge Connections**

Identifying relationships between different discoveries.

### 6.3 Personalisation

Personalisation may use:

- Explicitly selected interests.
- Saved discoveries.
- User-approved preferences.
- Recent interactions.
- Preferred discovery categories.

The system should provide options for controlling recommendations and stored information.

A user should be able to choose between familiar topics and unfamiliar discoveries.

### 6.4 Reliability

The AI system should distinguish between:

1. Information retrieved from verified sources.
2. General explanations based on model knowledge.
3. Speculative interpretations or creative content.

Where appropriate, users should be able to inspect supporting sources.

Scientific calculations, external navigation and other deterministic operations will be performed by dedicated software components.

### 6.5 Privacy

Personal conversations and saved information will remain private by default.

User data must be stored securely and accessible only through authorised accounts.

Memory and personalisation settings should be transparent and controllable.

---

## 7. Core User Experience

The application will provide three main interaction modes.

### 7.1 Explore Mode

The normal first-person environment.

Users walk between rooms, interact with objects and explore the property.

### 7.2 Focus Mode

Activated when an interaction requires attention.

Examples include watching a video, reading, viewing maps or having an extended conversation.

The camera moves to an appropriate position and displays a larger, readable interface.

The 3D environment remains part of the presentation but does not interfere with the activity.

### 7.3 Quick Access Mode

Users can access major features through a shortcut menu without physically navigating to each room.

This prevents exploration mechanics from becoming an inconvenience.

### Example session

A user opens The Curiosity Atlas.

They enter the main hallway and interact with the Discovery Fountain.

After learning something interesting, they enter the library to explore the topic further.

The curator suggests a related video, so they visit the theatre.

After watching it, they enter the Philosophy Lounge to discuss an idea raised in the video.

Before leaving, they save an interesting insight to the library.

The entire experience might take fifteen minutes.

Nothing requires the user to complete additional tasks or maintain a streak.

---

## 8. Technical Architecture

### 8.1 Recommended Technology Stack

| Component | Technology |
| --- | --- |
| Frontend | React |
| Programming language | TypeScript |
| Development environment | Vite |
| 3D rendering | Three.js |
| React 3D integration | React Three Fiber |
| 3D utilities | React Three Drei |
| 3D model creation | Blender |
| Styling and interfaces | HTML and CSS |
| Backend | Node.js / TypeScript |
| Database | PostgreSQL, potentially through Supabase |
| AI | OpenAI API or equivalent |
| Mapping | MapLibre with suitable external data providers |
| Media playback | YouTube IFrame API and browser-native video |
| Version control | Git |
| Code repository | GitHub |
| Hosting | Vercel, Netlify or equivalent |

The exact hosting, database and AI providers may be changed if another option is more suitable.

### 8.2 Architectural Principles

The application must be modular.

Three concerns should remain separate.

**Environment System**

Responsible for the 3D home, rooms, player controls, objects, lighting and transitions.

**Feature System**

Responsible for functionality such as discoveries, conversations, media playback and scientific experiments.

**Service System**

Responsible for AI requests, databases, external APIs, authentication and content retrieval.

This separation allows individual components to be updated without unnecessarily affecting the entire application.

### 8.3 Room Registry

Each room will have a standard configuration.

This may include:

- Room identifier.
- Display name.
- Associated 3D assets.
- Entrances and exits.
- Available interactions.
- Loading settings.
- Associated features.

The Room Manager will use this information to coordinate transitions and asset loading.

### 8.4 User Interface

Complex interfaces should primarily use conventional web components.

For example, a video displayed on a virtual screen may transition into a larger web-based playback interface when selected.

Similarly, the library can present a beautiful 3D bookshelf while providing a conventional searchable reading interface.

This hybrid approach allows immersive presentation without sacrificing usability.

---

## 9. Project Repository Structure

The project will be maintained through Git and GitHub.

Proposed structure:

```
curiosity-atlas/
│
├── public/
│   ├── models/
│   │   ├── buildings/
│   │   ├── furniture/
│   │   └── objects/
│   ├── textures/
│   └── audio/
│
├── src/
│   ├── world/
│   │   ├── World.tsx
│   │   ├── Player.tsx
│   │   ├── Camera.tsx
│   │   ├── RoomManager.tsx
│   │   └── InteractionSystem.tsx
│   │
│   ├── rooms/
│   │   ├── MainHall.tsx
│   │   ├── Theatre.tsx
│   │   ├── Library.tsx
│   │   ├── Observatory.tsx
│   │   ├── Laboratory.tsx
│   │   ├── PhilosophyLounge.tsx
│   │   └── Cafe.tsx
│   │
│   ├── features/
│   │   ├── discoveries/
│   │   ├── philosophy/
│   │   ├── cinema/
│   │   ├── tourism/
│   │   ├── experiments/
│   │   └── knowledge/
│   │
│   ├── components/
│   ├── services/
│   ├── hooks/
│   ├── types/
│   ├── App.tsx
│   └── main.tsx
│
├── docs/
│   ├── PROJECT_SPEC.md
│   └── ROADMAP.md
│
├── AGENTS.md
├── README.md
└── package.json
```

The structure may evolve as implementation requirements become clearer.

---

## 10. AI-Assisted Development Workflow

The application will be developed incrementally with assistance from AI coding tools.

GitHub will serve as the central source repository.

### Standard development process

1. **Define a feature**

   Describe its intended behaviour, design requirements and technical constraints.

2. **Review the existing architecture**

   The coding agent examines the relevant project files and conventions.

3. **Implement the feature**

   Changes are made to the appropriate components.

4. **Test**

   The application is run and relevant functionality is checked.

5. **Review the changes**

   Changes are inspected before being merged into the main branch.

6. **Update GitHub**

   The accepted changes become part of the maintained project.

7. **Deploy**

   The hosting service builds and publishes the updated application.

### AI development rules

AI agents should:

- Follow the master specification.
- Preserve existing functionality unless changes are requested.
- Reuse established components where practical.
- Avoid unnecessary dependencies.
- Keep features modular.
- Add or update tests for important logic.
- Document significant architectural changes.
- Avoid exposing credentials or private information.

The repository should include an AGENTS.md file containing these rules.

AI agents may modify the project when given appropriate access and instructions, but updates should not occur autonomously without an authorised development workflow.

---

## 11. Development Roadmap

Development will follow clearly defined stages.

The earliest priority is establishing a functional 3D environment, not immediately implementing every AI feature.

### Phase 0 — Project Foundation

Objective: Establish the development environment.

Tasks:

1. Initialise a React and TypeScript project using Vite.
2. Install Three.js and React Three Fiber.
3. Establish the project directory structure.
4. Initialise Git and create a private GitHub repository.
5. Configure local development.
6. Create an initial 3D scene.
7. Establish basic camera controls.

Deliverable: A website that loads an interactive 3D environment.

### Phase 1 — Prototype 0.0.1: Explorable Property

Objective: Demonstrate the core spatial experience.

Required environments:

- Main hallway.
- Theatre.
- Observatory.
- Small courtyard.
- Exterior representation of the café.

Initial rooms may use placeholder geometry.

#### Functional requirements

- First-person movement.
- Mouse-controlled camera.
- Basic collisions.
- Interactive doors.
- Room transitions.
- Dynamic room loading.
- Basic lighting.
- Simple interaction prompts.
- Working navigation between environments.

The theatre and observatory do not yet require their advanced features.

Deliverable: A playable website where the user can move through the property, open doors and enter individually loaded rooms.

#### Acceptance criteria

The prototype is complete when:

- The user can navigate the environment.
- Doors function consistently.
- Rooms load when needed.
- Exiting a room returns the user to the correct location.
- The application remains stable during repeated transitions.
- Unnecessary interior models are not all rendered simultaneously.

### Phase 2 — Prototype 0.1: Core Curiosity Experience

Objective: Make the application genuinely useful.

Implement:

**Discovery Fountain**

Present and explain curated daily discoveries.

**Philosophy Lounge**

Support natural AI conversations through a simple text interface.

**Library of Discoveries**

Allow users to save and revisit discoveries.

**Basic Curator**

Provide AI explanations and conversations through a secure backend.

#### Additional requirements

- Persistent local storage or a simple database.
- Basic interface transitions.
- Navigation between the central features.
- Error handling for AI requests.
- Loading and connection indicators.

Deliverable: A user can discover something, discuss it with AI and save it for later.

This establishes the core product experience.

### Phase 3 — Prototype 0.2: Media and Exploration

Objective: Expand beyond conversation and facts.

Implement:

- Functional theatre video player.
- AI-curated video recommendations.
- Saved watchlist.
- Basic City Explorer.
- London neighbourhood discovery.
- Simple itinerary generation using verified geographical information.
- Improved library organisation.

Deliverable: Users can discover information, watch relevant content and plan real-world experiences.

### Phase 4 — Version 0.3: Interactive Environments

Objective: Expand the educational and exploratory possibilities of the property.

Introduce the first functional versions of:

- Observatory.
- Museum.
- Experimental Laboratory.
- Workshop.
- Outdoor café.

These environments should initially contain a small number of high-quality interactions.

For example, the laboratory might include two validated scientific simulations rather than dozens of incomplete experiments.

Deliverable: A broader but still manageable collection of interactive experiences.

### Phase 5 — Private Beta

Objective: Test usability and enjoyment with other users.

Activities:

- Improve navigation and interactions.
- Refine the visual environment.
- Optimise performance.
- Address accessibility issues.
- Improve reliability.
- Evaluate AI costs.
- Introduce account functionality where necessary.
- Gather user feedback.

The central question is whether users find the environment enjoyable enough to return to voluntarily.

Deliverable: A stable application suitable for a small group of testers.

### Phase 6 — Future Development

Potential additions include:

- Voice conversations.
- Animated AI companions.
- More advanced experiments.
- Interactive historical experiences.
- Multiplayer visits.
- Shared video sessions.
- Additional rooms.
- User-customisable interiors.
- Expanded city exploration.
- Mobile companion functionality.
- Community-created experiences.

These features are not requirements for the initial release.

---

## 12. Performance and Accessibility

The application should run on ordinary modern desktop browsers without requiring specialist gaming hardware.

### Performance priorities

- Small initial download.
- Efficient 3D assets.
- Dynamic loading of interiors.
- Adjustable rendering quality.
- Stable frame rates.
- Responsive interactions.
- Efficient API usage.
- Avoidance of unnecessary background processing.

### Accessibility priorities

Users should have options for:

- Adjusting movement sensitivity.
- Reducing camera motion.
- Using readable text interfaces.
- Enabling subtitles.
- Controlling audio levels.
- Navigating major features without extensive first-person movement.

A conventional non-3D navigation interface should remain available for important functionality.

---

## 13. Data and Content Management

The application will maintain structured records for discoveries and saved content.

### Example discovery record

```
Discovery
│
├── Identifier
├── Title
├── Category
├── Explanation
├── Difficulty
├── Estimated reading time
├── Sources
├── Related discoveries
├── Recommended videos
└── Available interactions
```

This structure allows the same discovery to be used across multiple rooms.

For example, a discovery about atmospheric pressure could appear in the fountain, be saved in the library and link to a simulation in the laboratory.

### User data

Future account functionality may store:

- User preferences.
- Saved discoveries.
- Watchlists.
- Library collections.
- Discovery history.
- Optional conversation records.
- Travel collections.
- Progress in interactive experiences.

User data must be protected through secure authentication and appropriate database access controls.

AI API credentials must be stored securely on the server and never exposed in client-side code.

---

## 14. Scope Management

The Curiosity Atlas is deliberately not intended to become an enormous open-world game.

The following features are excluded from the first release:

- A large explorable city.
- Fully generated historical worlds.
- Advanced multiplayer gameplay.
- Complex character animation.
- An unrestricted embedded browser.
- Fully autonomous AI world generation.
- Universal scientific simulation.
- Extensive character customisation.
- A marketplace for community-generated content.

These ideas may be revisited in the future.

The immediate objective is to create a small environment whose interactions are genuinely enjoyable and useful.

Development priority: depth before breadth.

---

## 15. Indicative Development Resources

The project should initially be treated as a small, independently developed application.

### Initial requirements

- A laptop or desktop development environment.
- Node.js.
- Visual Studio Code or another suitable editor.
- A GitHub repository.
- React and Three.js dependencies.
- Basic placeholder 3D assets.
- An AI coding assistant.

Most foundational software can be used without significant upfront expenditure.

### Estimated expenses

Potential costs include:

- Optional premium 3D assets.
- Website hosting.
- Database services.
- AI API usage.
- External mapping services.
- Domain registration.

The earliest architectural prototype should require little or no paid infrastructure.

Recurring costs will increase as AI features and third-party integrations become more widely used.

No paid service should be introduced until it is needed for a specific feature.

---

## 16. Product Success Criteria

Success should not be judged primarily by how long users remain inside the application.

Instead, the product should be evaluated according to whether it creates enjoyable and meaningful experiences.

Important indicators include:

**Discovery**

Do users regularly encounter subjects they find interesting?

**Engagement**

Do users voluntarily return?

**Usefulness**

Do the AI features help users understand, explore or reflect?

**Exploration**

Do users enjoy interacting with the virtual environment?

**Knowledge Retention**

Do users revisit discoveries and build personal collections?

**Accessibility**

Can users reach their desired features without unnecessary effort?

**Performance**

Does the application remain stable and responsive?

The most important measure is whether The Curiosity Atlas provides enough value to justify using it instead of opening an ordinary chatbot, video website or social media application.

---

## 17. Initial Development Milestone

The immediate task is to create the technical foundation.

The first milestone will not require the complete AI system.

It will focus on one experience:

A user opens The Curiosity Atlas in their browser, finds themselves in a small virtual hallway, walks towards a door, opens it and enters another room.

The transition should demonstrate the modular loading system.

The user should then be able to leave that room, return to the hallway and enter another environment.

Once this works reliably, the project can expand through new environments and interactive features.

This first milestone establishes the foundation for the entire application.

---

## 18. Final Product Vision

The Curiosity Atlas should eventually feel like a personal retreat for intellectual curiosity.

A place where someone can enter without a specific objective and still discover something worthwhile.

A place where fascinating information is encountered through objects and environments rather than endless feeds.

A place where artificial intelligence takes on different forms depending on the activity.

A place where users can watch, read, experiment, reflect, plan real-world adventures and gradually build their own collection of discoveries.

The application should combine the atmosphere and enjoyment of an interactive game with the practical usefulness of modern AI.

Its physical environment will remain deliberately modest.

Its intellectual possibilities should not.

**The Curiosity Atlas — A small world built for endless curiosity.**

---

*End of Master Specification — Version 1.0*
