// Gear trains. Meshing gears share the speed at their pitch circles, so with
// teeth of the same size each gear turns at a speed inversely proportional to
// its number of teeth. Torque goes the other way, so power (speed × torque)
// is the same all along an ideal train. Friction is ignored.

/** One meshing pair: the gear doing the driving, and the gear it drives. */
export interface Stage {
  driver: number
  driven: number
}

/** Tooth counts on the workshop's gear rack. */
export const TEETH = [8, 10, 12, 16, 20, 24, 30, 32, 36, 40, 48, 60]

export const GEAR_START = { rpm: 60, torque: 1, stages: [{ driver: 12, driven: 36 }] as Stage[] }
export const MAX_STAGES = 3

export interface TrainResult {
  /** How many times the input turns for each turn of the output. */
  ratio: number
  rpm: number
  torque: number
  /** +1 if the output turns the same way as the input, -1 if it turns the other way. */
  direction: 1 | -1
}

/**
 * A compound train: each stage's driven gear is fixed to the same shaft as the next stage's driver.
 * Every mesh reverses the direction of turning.
 */
export function train(stages: Stage[], rpm: number, torque: number): TrainResult {
  const ratio = stages.reduce((r, s) => (r * s.driven) / s.driver, 1)
  return { ratio, rpm: rpm / ratio, torque: torque * ratio, direction: stages.length % 2 ? -1 : 1 }
}

/** Challenges for the bench, each with the ratio it needs. */
export const CHALLENGES = [
  {
    id: 'clock',
    name: "A clock's motion work",
    goal: 'Turn the hour hand once for every 12 turns of the minute hand',
    ratio: 12,
  },
  { id: 'winch', name: 'A hand winch', goal: 'Multiply the turning force of the handle by 6', ratio: 6 },
  { id: 'drill', name: 'A hand drill', goal: 'Spin the chuck 4 times for each turn of the handle', ratio: 1 / 4 },
  {
    id: 'same-way',
    name: 'Same direction',
    goal: 'Keep the output turning the same way as the input, at the same speed',
    ratio: 1,
    direction: 1,
  },
] as const

export function meetsChallenge(result: TrainResult, challenge: (typeof CHALLENGES)[number]) {
  const ratioOk = Math.abs(result.ratio - challenge.ratio) < 1e-9
  return ratioOk && (!('direction' in challenge) || result.direction === challenge.direction)
}
