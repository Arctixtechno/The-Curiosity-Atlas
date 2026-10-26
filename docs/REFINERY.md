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
| 5 | **Isomerisation**, **gas plant** and **alkylation**; blending petrol and diesel to spec from every unit's streams | ⬜ |
| 6 | **Hydrocracker** and **delayed coker**, then the control room as a full DCS: several units at once, cascade and feed-forward control, start-up and shutdown procedures, relief and flare, permits and a HAZOP walk-through | ⬜ |

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
- **Live plant** (`plant.ts`): runs only while the operator panel is open, at 1, 10 or 30 times real time, with trend history and an alarm log. The furnace in the 3D site glows with its firing.

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
