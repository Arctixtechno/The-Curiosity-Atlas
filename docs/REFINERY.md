# Marshgate Refinery

A process plant you can learn on, a drive away from the house. It is fictional, set on the Thames estuary, and built in stages so each unit gets the depth it deserves.

## How you get there

A car is parked in the courtyard by the east hedge. Getting in plays a drive (London rooftops, then the marshes, then the refinery's columns and flares) while the site loads in the background, with facts about refining on the way. The return trip runs the other way. <kbd>Space</kbd> skips ahead. Any room with a `journey` in the registry gets the same treatment, so other far-away places can reuse it.

## Stages

| Stage | What opens | Status |
| --- | --- | --- |
| 1 | The drive, the site, the site board (every unit explained, with a block flow diagram) and the **crude distillation unit**: furnace and its temperature controller, column draws, stripping steam, product specs, sulphur, economics, alarms and shift tasks | ✅ Done |
| 2 | **Vacuum unit** and **fluid catalytic cracker**: riser temperature, catalyst-to-oil ratio, the reactor–regenerator heat balance, conversion against coke and gas make, slide valves | ⬜ |
| 3 | **Naphtha hydrotreater** and **catalytic reformer**: reactor inlet temperatures, the octane–yield trade-off, hydrogen make, catalyst deactivation and regeneration | ⬜ |
| 4 | **Hydrotreaters, amine and sulphur recovery**: where the sulphur goes, ultra-low-sulphur diesel, hydrogen balance; **gas plant** and **alkylation**; blending products to spec | ⬜ |
| 5 | **Hydrocracker** and **delayed coker**, then the control room as a full DCS: several units at once, cascade and feed-forward control, start-up and shutdown procedures, relief and flare, permits and a HAZOP walk-through | ⬜ |

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
