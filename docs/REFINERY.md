# Marshgate Refinery

A process plant you can learn on, a drive away from the house. It is fictional, set on the Thames estuary, and built in stages so each unit gets the depth it deserves.

## How you get there

A car is parked in the courtyard by the east hedge. Getting in plays a drive (London rooftops, then the marshes, then the refinery's columns and flares) while the site loads in the background, with facts about refining on the way. The return trip runs the other way. <kbd>Space</kbd> skips ahead. Any room with a `journey` in the registry gets the same treatment, so other far-away places can reuse it.

## Stages

| Stage | What opens | Status |
| --- | --- | --- |
| 1 | The drive, the site, the site board (every unit explained, with a block flow diagram) and the **crude distillation unit**: furnace and its temperature controller, column draws, stripping steam, product specs, sulphur, economics, alarms and shift tasks | ✅ Done |
| 2 | **Vacuum unit** and **fluid catalytic cracker**: vacuum cut point from pressure, heat and steam; feed quality (carbon residue, metals); riser temperature, catalyst-to-oil ratio, the reactor–regenerator heat balance, conversion against coke and gas make, regenerator, air blower, wet gas compressor and slide valve limits, catalyst cooler; shift tasks | ✅ Done |
| 3 | **Naphtha hydrotreater** and **catalytic reformer**: sulphur removal and breakthrough, reactor inlet temperatures, the three-reactor temperature profile, the octane–yield trade-off, pressure and hydrogen, hydrogen make, catalyst coking over a whole cycle and regeneration; shift tasks | ✅ Done |
| 4 | **Diesel hydrotreater**, **hydrogen header**, **amine unit** and **Claus sulphur recovery**: ultra-low-sulphur diesel, cracked stock, hydrogen balance, where the crude's sulphur goes, the 2:1 air ratio, converters and tail gas unit, SO₂ permit; shift tasks | ✅ Done |
| 5 | **Gas plant**, **isomerisation** and **alkylation**; **blending** petrol and diesel to EN 228 and EN 590 from every unit's streams, with a linear-programming planner to compare against; shift tasks | ✅ Done |
| 6 | **Hydrocracker**, **delayed coker** and a **steam methane reformer**; the whole site as one live plant with a tank farm; the control room as a DCS with alarms, trends, feed-forward and advanced control | ✅ Done |
| 7 | ✅ **Training centre**: guided lessons on the live plant with a coach, quizzes, a glossary, certificates and an engineer's notebook. ✅ **Safety and emergencies**: drills on the live plant, relief and flare, permits to work, a HAZOP and incident case studies. ✅ **Planning and trading**: eight crudes, a crude-slate LP with shadow prices, a daily market with cracks, a carbon price, and a turnaround's critical path. Still to come: the living site | 🚧 |

## The crude unit model (stage 1)

All in `src/features/refinery/`, with unit tests in `refinery.test.ts`.

- **Crude assays** (`crudes.ts`): Brent, WTI, Arab Light and Maya, each with a true boiling point curve, API gravity, sulphur and an illustrative price. Rounded from typical published assays.
- **Column** (`cdu.ts`, steady state):
  - The top temperature sets the naphtha cut point (TBP end point = top temperature + 40 °C).
  - Kerosene and diesel draws, as % of crude, set the other cut points by mass balance on the boiling curve, which is how operators actually move cut points.
  - The flash zone lifts what boils below the furnace outlet + 10 °C (steam lowers partial pressure), less 4% overflash. Ask for more and the diesel draw tray runs dry.
  - Flash points from the 10% point by the Riazi–Daubert correlation; side products' front ends depend on stripping steam, back ends overlap by 12 °C.
  - Specs: Jet A-1 flash ≥ 38 °C and final boiling point ≤ 300 °C; EN 590 diesel flash > 55 °C and 95% point ≤ 360 °C; reformer feed end point ≤ 200 °C.
  - Sulphur is shared between products by boiling range, so it gathers in the heavy end, and balances exactly with the crude.
  - Economics at illustrative transfer prices; off-spec product goes to slops.
- **Furnace** (`furnace.ts`, dynamic): a first-order lag (3 minute time constant) with 30 s dead time, the standard model for a fired heater, driven by a velocity-form PID with derivative on measurement, bumpless auto/manual transfer, a high-high trip at 385 °C and disturbances (preheat fouling, lean fuel gas). Default tuning from the IMC rule.
- **Live plant** (`plant.ts`): runs at 1, 10 or 30 times real time while you are on site or have any refinery screen open (one shared clock, `clock.ts`), with trend history and an alarm log. The furnace in the 3D site glows with its firing.

Simplifications, stated in the panel too: no tray-by-tray calculation, TBP rather than ASTM D86 boiling points, and fixed column pressure.

## The vacuum unit and cat cracker (stage 2)

One operator screen (`ConversionPanel.tsx`) runs both, because what the vacuum unit makes decides how the cracker runs. It opens from either unit's sign on site or from the site board. Both are steady-state models that answer at once, fed by whatever the crude unit is doing (crude, rate and residue cut point). Tests are in `conversion.test.ts`.

- **Vacuum unit** (`vdu.ts`):
  - The cut point is the flash zone temperature converted to its atmospheric equivalent with Clausius–Clapeyron at constant entropy of vaporisation (ΔS/R = 12, about 100 J/mol·K for heavy oils), less 10 °C for wash oil and overflash: `AET = T · (1 − ln(P/760)/12)`. Steam takes 30% of the vapour, lowering the oil's partial pressure. Design (395 °C, 40 mmHg, dry) cuts at about 550 °C; a deep wet cut reaches 600–630 °C.
  - Gas oil and vacuum residue come off the crude's TBP curve, so they balance with the crude unit's residue.
  - Conradson carbon and nickel plus vanadium climb steeply with cut depth (power laws on how far past 500 °C the cut is) and scale by crude: Maya's heavy end carries about 3 times Brent's carbon and 9 times its metals.
- **Cat cracker** (`fcc.ts`):
  - Conversion from second-order kinetics: `X/(1−X) = 0.936 · (C/O)^0.65 · exp(−6000 (1/T − 1/798 K)) · activity · crackability · (1 − 0.06 CCR)`, with activity falling with metals.
  - Coke = catalytic coke (1.4 · X/(1−X)) + 0.9 × feed carbon residue + stripper carry-over + nickel coke.
  - Heat balance, solved by bisection for the catalyst-to-oil ratio: coke burned (39.8 MJ/kg) = feed heating from preheat to riser outlet + vaporisation + heat of cracking + heating the regenerator air + catalyst cooler + losses. Regenerator temperature follows from the heat the catalyst carries. If the slide valve hits a limit the balance can't close and the screen shows the surplus or shortfall.
  - Yields: dry gas and LPG rise with conversion and riser temperature (LPG faster than linear as petrol overcracks), gasoline is the rest of the conversion, unconverted oil splits 68:32 into light cycle oil and slurry. Octane rises with riser temperature and conversion.
  - Limits: regenerator 750 °C, air blower 165 t/h (14 kg of air per kg of coke), wet gas compressor 50 t/h, slide valve between cat/oil 3.5 and 10.
  - Design (30 kb/d, 230 °C preheat, 525 °C riser, MAT 70) lines out at cat/oil about 6, regenerator about 730 °C, 75% conversion and 4.7% coke, typical of a vacuum gas oil cracker in Sadeghbeigi's handbook.
- **Shift tasks** (`conversionTasks.ts`): octane for the blenders, filling the cracker to 45 kb/d, a deep vacuum cut, and running Maya with clean enough feed. Each is checked in the tests to be undone at design and achievable.

## The naphtha hydrotreater and reformer (stage 3)

One screen (`ReformerPanel.tsx`), opened from the reformer's sign on site or from the site board. Tests are in `reforming.test.ts`.

- **Feed** (`plant.ts`): the crude unit's naphtha above 80 °C (the light part goes to isomerisation), so the crude, its rate and the column's top temperature all reach the reformer. Each crude's heavy naphtha has its own paraffin, naphthene and aromatic split (`NAPHTHA_PNA`), and the naphtha's end point sets how fast coke builds.
- **Hydrotreater** (`reformer.ts`, `runNht`): first-order desulphurisation with an activation energy of about 100 kJ/mol, scaled by space velocity. At design (320 °C) it removes 99.97% of the sulphur; 25 °C cooler and sulphur breaks through past the 0.5 ppm the platinum tolerates.
- **Reformer** (`runReformer`):
  - Three lumped reactions, each first order with an Arrhenius rate: naphthene dehydrogenation (fast, +2150 kJ/kg), paraffin dehydrocyclisation (slower, +2600 kJ/kg, held back by pressure) and hydrocracking (exothermic, helped by pressure, the yield loss).
  - Three adiabatic reactors holding 15, 30 and 55% of the catalyst, each integrated in 40 slices for composition and temperature together, with a furnace back to the inlet temperature before each. Design drops are about 90, 75 and 50 °C.
  - Octane from the reformate's composition (aromatics 111, naphthenes 72, remaining branched paraffins 62). Hydrogen from the stoichiometry: 3 H₂ per naphthene and 4 per paraffin reformed, less what cracking uses.
  - Catalyst activity falls with coke (e-fold per 14 wt%) and with sulphur over the limit. Coke builds at a rate that rises with temperature and feed end point and falls with pressure and hydrogen ratio. At design a cycle lasts about a year to the 20 wt% coke limit; holding 97.5 octane by raising the inlets runs out of furnace at about day 200.
  - Design (505 °C, 18 bar, H₂/oil 5) makes about 97 octane at 88.6 wt% reformate and 3.3 wt% hydrogen from Brent naphtha.
- **Catalyst cycle**: "Run 10/30/90 days" ages the catalyst at the current settings and plots inlet temperature and octane against days on stream. Regenerate starts a new cycle.
- **Shift tasks** (`reformingTasks.ts`): premium octane, hydrogen for the hydrotreaters, reforming paraffinic Arab Light, and a 240-day run without the octane dropping below 97 (impossible at design pressure; more pressure and hydrogen make it). The tests check each is undone at design and achievable.

## Hydrotreating, hydrogen and sulphur recovery (stage 4)

One screen (`TreatingPanel.tsx`), opened from the hydrotreating and sulphur plot on site (west of the crude furnace) or from any of its four units on the site board. Tests are in `treating.test.ts`.

- **Diesel hydrotreater** (`treating.ts`, `runDht`): two first-order sulphur lumps, easy (E/R 11 000 K, half order in pressure) and sterically hindered dibenzothiophenes (E/R 15 000 K, pressure order 1.3), scaled by space velocity. Straight-run gas oil has 20% of its sulphur in the hard lump and the cat cracker's light cycle oil 45%, and cycle oil's aromatics and nitrogen inhibit both. Design (345 °C, 45 bar) makes about 7 ppm from Brent; with cycle oil in it takes about 365 °C or 60 bar. Hydrogen use is lumped: about 0.45 wt% for straight-run and 2 wt% for cycle oil, rising with pressure as aromatics saturate.
- **Hydrogen header**: supply from the reformer, users the naphtha hydrotreater, kerosene treater and diesel hydrotreater. A shortfall is bought from a steam methane reformer; a surplus goes to fuel gas.
- **Sulphur sources**: H₂S from the naphtha hydrotreater, kerosene treater, diesel hydrotreater and cat cracker (45% of its feed's sulphur), compared with the sulphur in the crude.
- **Claus plant** (`runSru`): recovery 95.6% with two converters or 97.2% with three at the exact 2:1 ratio, less 0.09 points per (% air error)²; a tail gas unit recovers 97.5% of what's left. The analyser shows the tail gas H₂S:SO₂ ratio. Unrecovered sulphur leaves the stack as SO₂ against a 3 t/d permit; plant capacity is 150 t/d.
- **Shift tasks** (`treatingTasks.ts`): take the cycle oil into diesel on spec, do it on 30 t/d of hydrogen or less (temperature, not pressure), recover 97% without the tail gas unit (third converter and trimmed air), and run a sour crude inside the SO₂ permit.

## Light ends and blending (stage 5)

Two screens. The light ends screen (`LightEndsPanel.tsx`) opens from the gas plant plot east of the crude column, or from the gas plant, isomerisation or alkylation on the site board. The blending screen (`BlendingPanel.tsx`) opens from the blend header by the gate, or by clicking Petrol or Diesel on the site board. Both are fed live by every unit upstream (`lightEndsPlant.ts`). Tests are in `lightEnds.test.ts`.

- **LPG** comes from the crude unit's light ends, the cat cracker's LPG (rich in propylene and butylenes) and the reformer's, each split into propane, propylene, isobutane, butane and butylenes.
- **Depropaniser** (`lightEnds.ts`, `runGasPlant`): propane from butane at relative volatility 2.3. Underwood's minimum reflux for the key components, Gilliland's correlation in Eduljee's form for the stages that reflux needs, and Fenske for the split the column's 20 trays make. Reboiler duty is (R + 1) times the distillate's latent heat. Propane may carry 2.5% butane. Each chart sweeps the setting and can be clicked or dragged to move it.
- **Isomerisation** (`runIsom`): the branched share at equilibrium falls with temperature (92% at 100 °C), approached at an Arrhenius rate (E/R 8000 K), so once-through octane peaks near 160 °C at about 84. The deisohexaniser recycle sends 60% of what stayed straight back round, for about 4 more octane.
- **Sulphuric acid alkylation** (`runAlky`): alkylate octane falls with temperature, weak acid and propylene and rises with the isobutane ratio (96.4 at 5 °C, 8:1, 90% acid, butylenes only). Yield 1.78 bbl per bbl of butylene. Acid use scales up with temperature, propylene and strength and down with isobutane, around 0.3 lb per gallon. Isobutane short of what the unit needs is bought in.
- **Blending** (`blending.ts`): octane, aromatics, olefins, benzene, cetane and density blend by volume; sulphur and oxygen by mass; vapour pressure by Chevron's RVP<sup>1.25</sup> index and cloud point by an exponential index. Specs are EN 228 E10 Premium 95 and Super 98 (summer 45–60 kPa, winter 60–90 kPa) and EN 590 diesel (cetane 51, density 820–845, 10 ppm, cloud 0 °C summer and −5 °C winter, 7% FAME). Off-spec blends sell as blendstock at $68 a barrel; what isn't blended sells at its own value.
- **Planner** (`lp.ts`, `optimiseBlend`): every spec, written in blending indices, is linear in the volumes, so the best recipe is a linear programme, solved by a dense simplex with Bland's rule. The screen shows the planner's recipe beside yours.
- **Shift tasks** (`lightEndsTasks.ts`): on-spec propane on 5.3 MW of reboiler, 87.5 octane isomerate, 97 octane alkylate on 18 t/d of acid, alkylating propylene at 95 octane; and, by hand, summer Premium 95, Premium 95 within 0.3 octane of spec at 90% of the planner's margin, Super 98, and winter diesel. The tests check each is undone at the start and achievable.

## One live plant: margin, tank farm and saving

The plant manager's screen (`SitePanel.tsx`) opens from the tank farm sign between the crude and jet tanks, or from the button on the site board. Tests are in `site.test.ts`.

- **One clock** (`clock.ts`): every refinery screen and the site itself ask for the plant clock while they're open, and it runs while any of them do. The furnace, the trends and the tank farm all move on it.
- **Saving**: the whole plant (every unit's settings, the catalyst, the blend recipes and the tank farm) is saved in the browser a moment after each change, and loaded over a fresh plant on the next visit, so settings added later get their defaults. "Start afresh" puts everything back.
- **Site balance** (`site.ts`): crude in; LPG, petrol, export blendstock, jet, diesel, fuel oil and sulphur out at illustrative prices; and the costs the units run up: bought blend components, hydrogen and isobutane, alkylation acid, fuel for the furnaces and reboilers, steam and power, and vacuum gas oil drawn from or put into its tank at $80 a barrel. At the start, with every stream in the petrol pool, petrol is off spec and the site loses money; on the planner's blend it makes about $7 a barrel. A Sankey diagram shows where a barrel goes, and every unit's state is listed with a link to its screen.
- **Tank farm** (`tankFarm.ts`): eight tanks (crude, vacuum gas oil, LPG, petrol, jet, diesel, fuel oil and the sulphur pit), filled by the units' rates and emptied by steady liftings (road rack, airport pipeline, bunker barges, lorries) and by ships and trains you book. Ships take 3 days (crude) or 1.5 days (products) to arrive, one berth serves them in turn, and each day alongside past the first costs $35k of demurrage. A product tank topping out sells its overflow $20 a barrel below price; the crude tank reaching its heel shuts the plant down, losing the margin and still costing $180k a day. A standing order calls a crude cargo when the tank falls below 40%. The tank farm runs on the plant clock (stepped every simulated 10 minutes) and can be run ahead a day, a week or a month with the units held steady. On site, the tanks' floating roofs and gauge boards follow the levels.
- **Shift tasks** (`siteTasks.ts`): $600k a day, $10 a barrel, a week without a shutdown or tank-top sale, and a month with no demurrage either. The tests check each is undone at the start and achievable, including a 30-day ship schedule.

## The control room DCS

The control room on site now opens the DCS (`DcsPanel.tsx`, models in `dcs.ts`); the crude unit's own screen is still at the panel by its column. A beacon on the control room roof flashes amber while an alarm is unacknowledged, red for a high-priority one. Tests are in `dcs.test.ts`.

- **Tags**: 26 measurements across every unit, named the ISA way (TI-302, AI-502, LI-crude). Each moves towards the value the steady-state models give with a first-order lag of the time constant it has on a real plant: a minute for flows, ten for the cat cracker's regenerator, fifteen for analysers. The crude furnace outlet comes straight from the dynamic furnace model. Targets are worked out from the whole site at most twice a second, and at once when a setting changes; tags are sampled every 30 simulated seconds for two hours of trend.
- **Overview**: drawn to ISA-101's high-performance style. Grey unless something is wrong, each tag with a bar showing its limits, a half-hour sparkline and its value, which turns amber or red in alarm. Each area opens its unit's screen.
- **Alarms**: high, high-high, low and low-low limits on the tags, plus each unit's own warnings and off-spec blends, at three priorities shown by shape and colour. New alarms stay until acknowledged; cleared ones stay until acknowledged; alarms can be shelved for a plant hour. The screen counts alarms per hour against EEMUA 191's guidance. A banner shows the most urgent unacknowledged alarm on every tab.
- **Trends**: up to four pens, each on its own scale, over 30 minutes or 2 hours.
- **Advanced control**:
  - Feed-forward from crude rate to the furnace fuel valve: moves the valve by what the new rate needs when the rate changes, so the controller only trims. It cuts the outlet's integrated error after a 15 kb/d step by more than two thirds (the dead time still lets the first dip through).
  - A cat cracker constraint pusher: raises feed half a kb/d each simulated minute until the regenerator, air blower, wet gas compressor or slide valve limit (with a margin), holds there, and backs off if a limit is crossed.
  - A reformer octane controller: moves the reactor inlets half a degree a minute towards an octane target, acting on its model's prediction rather than the lagging analyser so it doesn't overshoot.

## The heavy end: coker, hydrocracker and hydrogen plant

One screen (`HeavyEndPanel.tsx`, models in `heavyEnd.ts`) with a switch between the three units, opened from any of their signs on site (the coker at the north-west corner, the hydrocracker north of the crude column, the hydrogen plant west of the control room) or from the coker or hydrocracker on the site board. All three start shut down: they've just been built. Tests are in `heavyEnd.test.ts`.

- **Delayed coker** (`runCoker`): takes all the vacuum residue when running. Yields from Gary and Handwerk on the residue's Conradson carbon (coke 1.6 × CCR, gas 7.8 + 0.144 CCR, naphtha 11.29 + 0.343 CCR, gas oil the rest), with more coke and gas at higher drum pressure and recycle and less coke from a hotter heater. Residue carbon, sulphur and metals depend on the crude and rise with the vacuum unit's cut depth. Coke is anode grade from sweet crudes, fuel grade from sour. Two drums alternate on the plant clock: one fills for the cycle time while the other is steamed, quenched, drained, cut and warmed, drawn live on the screen and on site (the drill stem goes down the idle drum). The drum's fill at the switch must stay under 100% or it foams over; the cycle can't be shorter than the 14 hours decoking takes.
- **Hydrocracker** (`runHydrocracker`): fresh vacuum gas oil (taken from the same pool as the cat cracker, so the gas oil tank feels it) plus the coker's gas oil. First-order cracking with E/R 18 000 K, helped by pressure and held back by coker gas oil's nitrogen; conversion per pass falls with space velocity. Recycling the unconverted oil reaches 95–98% overall; once through, the unconverted oil goes to the gas oil tank. Selectivity to jet and diesel falls as each pass is pushed harder. Hydrogen use 2–3 wt%. Its diesel (cetane about 57, 3 ppm sulphur, cloud −14 °C) joins the diesel pool; its jet joins the jet tank.
- **Hydrogen plant** (`runSmr`): solves CH₄ + H₂O ⇌ CO + 3H₂ and the water–gas shift at the tube outlet and 25 bar (standard equilibrium constants), adds a high-temperature shift reactor and a PSA recovering 89%. It follows the hydrogen header, making whatever the reformer can't up to 120 t/d. At 860 °C and S/C 3 it converts about 82% of the methane, uses about 158 MJ of gas and releases about 8.6 t of CO₂ per tonne of hydrogen, at about $1,400 a tonne against $1,800 to buy.
- **On the site**: residue no longer goes to fuel oil at $48 a barrel; coke is sold by the tonne; coker and hydrocracker naphtha are exported; LPG from both joins the gas plant; the hydrocracker and coker send H₂S to the sulphur plant; and the DCS has tags for the filling drum, the hydrocracker beds and conversion, and the reformer tubes.
- **Shift tasks** (`heavyEndTasks.ts`): bring the coker on line within its drum and coke limits, coke Maya's residue, make 6 kb/d of hydrocracked diesel, recycle to extinction at 95%, run 15 kb/d through the hydrocracker on hydrogen made on site, and make hydrogen on 160 MJ a kilogram or less.


## The training centre

A portakabin in front of the control room, its door facing the car park, opens the training centre (`AcademyPanel.tsx`; lessons, quizzes, glossary and notebook readings in `academy.ts`; progress in `academyStore.ts`, saved in the browser). The site board links to it too. A board by its door lights a lamp for each lesson finished. Tests are in `academy.test.ts`.

- **Guided lessons**: seven, one for each part of the site (the crude unit, cat cracking, reforming, treating, the control room, the business and the heavy end), each three to six steps. Every step is a check on the live plant: a screen open, a setpoint moved, a spec met, a margin made. A coach card (`LessonCoach.tsx`) sits in the corner over the world and any screen, ticks each step off when the plant reaches it and says what it showed. Each step has a button to open its screen and one to do it for you. A test runs every lesson to the end with those buttons alone.
- **Quizzes**: five questions a topic, seven topics, each answer explained. The best score is kept and four out of five is a pass.
- **Glossary**: about seventy terms, A to Z, searched by term first and then by meaning.
- **Certificates**: one for each lesson, earned by finishing it and passing its quiz, and a full-course certificate for all seven. Each prints with the trainee's name.
- **Engineer's notebook**: notes, each saved with a snapshot of the plant's key readings (crude and rate, furnace outlet, kerosene, cat cracker conversion and octane, reformate octane, diesel sulphur, sulphur recovery and the site margin) and the plant time, and downloadable as text.

## Safety and emergencies

The muster point by the gate, or the sign at the flare's foot, opens the safety screen (`SafetyPanel.tsx`; drills in `drills.ts`, the flare in `flare.ts`, permits, the HAZOP and incidents in `permits.ts`, results in `safetyStore.ts`). Tests are in `safety.test.ts`.

- **Drills**: four emergencies (the crude charge pump trips, a furnace flame-out on lean fuel gas, an H₂S leak at the sulphur plant, cooling water lost at the crude column) and one procedure (shutting the crude unit down for a turnaround). Each puts its upset on the live plant: the feed falls, the fuel goes lean, and the readings on the screen and the DCS move. The clock drops to real time. The trainee picks actions from a scrambled list. A right action in its turn acts on the plant (the valve closes, the feed comes back); a wrong one is struck through and logged with why it's dangerous; one too early is logged too. Miss the deadline and it escalates, and the cooling water drill sends 120 t/h to the flare. A banner across the top of the screen follows the drill wherever you are on site, and the siren beacon at the muster point turns. Scores are out of 100 and the best is kept.
- **Relief and flare**: API 521's point-source method. The heat released is the relief load times 46 MJ/kg; flame length is an approximate fit to API 521's chart, L ≈ 0.0033 Q^0.48 (Q in W); a quarter of the heat is radiated from the flame's centre. Five relief cases from purge gas to a site-wide power failure (260 t/h, 3.3 GW, a 116 m flame). The screen draws the stack and flame to scale with the radiation contours and a ground strip coloured by API 521's levels (1.58, 4.73, 6.31 and 9.46 kW/m²), lists the radiation at receivers on a full-size site, and how far out each level reaches. Steam to the tip decides between smoking, smokeless and over-steamed. A test firing makes the site's flare burn that load for three minutes, and the 3D flame grows with whatever the flare burns.
- **Permit to work**: three jobs (cold work on a naphtha valve, hot work by the LPG spheres, entry into a sour water drum). Choose the controls the job needs, and only those, and read the gas test against the usual limits (under 10% of the LEL, 1% to enter; oxygen 19.5–23.5%; H₂S under 5 ppm). The drum's oxygen is 19.1%, so its permit can't be issued until it is ventilated.
- **HAZOP**: a worksheet for the crude column's reflux drum and pump: six deviations (no flow, more pressure, more and less level, water, reverse flow), each with a cause, consequence and safeguard to pick.
- **Lessons from incidents**: Texas City (2005), Buncefield (2005), Piper Alpha (1988) and Flixborough (1974): what happened, what went wrong, what the industry learnt, and a link to the part of the screen that practises it.

## Planning and trading

The planning office, upstairs in the cabin in front of the control room (its stair is at the west end), opens the planners' screen (`PlanningPanel.tsx`; the slate and the turnaround in `planning.ts`, prices in `market.ts`). The plant manager's screen and the site board link to it. Tests are in `planning.test.ts`.

- **Eight crudes**: Bonny Light (sweet, rich in middle distillates), Johan Sverdrup (medium, little naphtha), Basrah Medium (medium and very sour) and Western Canadian Select (diluted bitumen: light ends, a thin middle and 43% vacuum residue) join Brent, WTI, Arab Light and Maya. Each has its own boiling curve, residue quality, naphtha composition and cracking behaviour, rounded from typical assays, and runs through every unit.
- **Crude plan**: every crude is run through the whole site model at 100 kb/d (the one running now as it's set; the others at their natural kerosene and diesel cuts with both blends re-planned). A linear programme (`lp.ts`) chooses next month's barrels of each for the most margin, within the crude unit (120 kb/d), the residue the site can handle (the coker's 25 kb/d, or 22 kb/d of fuel oil sales without it), the sulphur plant's 150 t/d, and two 600 kbbl cargoes a grade. Shadow prices come from re-solving with each limit 1% looser. Take a crude off offer or change its discount and the slate and shadow prices move. With today's settings the residue outlet binds hard, at about $27 a barrel: the case for the coker.
- **Market**: a made-up but realistically shaped market, fixed by the day so it can be tested. Brent wanders around $82 over months; petrol cracks peak in summer, diesel's and gas's in winter. With *Trade at market prices* on, the site's margin, the tank farm's books and the DCS's margin tag use the day's prices. Every crude moves with Brent, every product with Brent and its crack, and fuel with gas. The market moves a day each time the tank farm runs a day.
- **Carbon**: the site's direct CO₂ from fuel burnt (0.056 t/GJ), coke burnt in the cat cracker's regenerator (3.67 t per tonne) and the hydrogen plant, about 14 kg a barrel. A carbon price adds a cost line to the margin.
- **Turnaround**: eleven jobs with their dependencies, scheduled by the critical path method (earliest starts forward, latest finishes back, zero slack is critical). Extra crews shorten five of the jobs at a price, against a day's lost margin. Crashing a job off the critical path only buys it slack. The planner's best is found by trying all 32 combinations.
