import { LESSONS, PASS_MARK, TOPICS } from './academy.ts'
import { CHALLENGES } from './challenges.ts'
import { CONVERSION_TASKS } from './conversionTasks.ts'
import { DRILLS } from './drills.ts'
import { HEAVY_END_TASKS } from './heavyEndTasks.ts'
import { BLENDING_TASKS, LIGHT_ENDS_TASKS } from './lightEndsTasks.ts'
import {
  ACADEMY_OVERLAY,
  CDU_OVERLAY,
  ROUNDS_OVERLAY,
  SAFETY_OVERLAY,
  SHIFT_OVERLAY,
} from './overlayIds.ts'
import { PERMIT_JOBS } from './permits.ts'
import { REFORMING_TASKS } from './reformingTasks.ts'
import { CHECKPOINTS } from './rounds.ts'
import { SHIFTS } from './shifts.ts'
import { SITE_TASKS } from './siteTasks.ts'
import { TREATING_TASKS } from './treatingTasks.ts'

// The operator's logbook: everything done across the refinery, from shift
// tasks and lessons to drills, rounds and shifts, turned into medals and a
// rank, so there's always a next thing to go for.

export type Tier = 'none' | 'bronze' | 'silver' | 'gold'

export interface Progress {
  tasksDone: ReadonlySet<string>
  lessonsDone: string[]
  quiz: Record<string, number>
  drillBest: Record<string, number>
  permits: string[]
  roundBest: number
  shiftBest: Record<string, number>
}

export interface Medal {
  id: string
  title: string
  text: string
  have: number
  of: number
  /** What it takes for bronze, silver and gold. */
  steps: [number, number, number]
  tier: Tier
  overlay: string
}

/** Every shift task on every screen. */
export const ALL_TASK_IDS = [CHALLENGES, CONVERSION_TASKS, REFORMING_TASKS, TREATING_TASKS, LIGHT_ENDS_TASKS, BLENDING_TASKS, HEAVY_END_TASKS, SITE_TASKS].flatMap((list) =>
  list.map((t: { id: string }) => t.id),
)

export const RANKS = [
  { points: 0, title: 'Trainee' },
  { points: 3, title: 'Field operator' },
  { points: 7, title: 'Panel operator' },
  { points: 11, title: 'Shift supervisor' },
  { points: 16, title: 'Operations manager' },
  { points: 21, title: 'Refinery manager' },
]

const TIER_POINTS: Record<Tier, number> = { none: 0, bronze: 1, silver: 2, gold: 3 }

function medal(m: Omit<Medal, 'tier'>): Medal {
  const [b, s, g] = m.steps
  const tier: Tier = m.have >= g ? 'gold' : m.have >= s ? 'silver' : m.have >= b ? 'bronze' : 'none'
  return { ...m, tier }
}

export function medals(p: Progress): Medal[] {
  const tasks = ALL_TASK_IDS.filter((id) => p.tasksDone.has(id)).length
  const n = ALL_TASK_IDS.length
  const passed = TOPICS.filter((t) => (p.quiz[t.id] ?? 0) >= PASS_MARK).length
  const drills = DRILLS.filter((d) => (p.drillBest[d.id] ?? 0) >= 80).length
  const stars = SHIFTS.reduce((sum, s) => sum + (p.shiftBest[s.id] ?? 0), 0)
  return [
    medal({ id: 'tasks', title: 'Hands on the plant', text: 'Shift tasks done on the unit screens', have: tasks, of: n, steps: [Math.ceil(n / 4), Math.ceil(n / 2), n], overlay: CDU_OVERLAY }),
    medal({ id: 'lessons', title: 'Scholar', text: 'Guided lessons finished in the training centre', have: p.lessonsDone.length, of: LESSONS.length, steps: [2, 4, LESSONS.length], overlay: ACADEMY_OVERLAY }),
    medal({ id: 'quizzes', title: 'Certified', text: `Quizzes passed with ${PASS_MARK * 100}% or more`, have: passed, of: TOPICS.length, steps: [2, 4, TOPICS.length], overlay: ACADEMY_OVERLAY }),
    medal({ id: 'drills', title: 'Cool head', text: 'Emergency drills handled with 80 or more', have: drills, of: DRILLS.length, steps: [1, 3, DRILLS.length], overlay: SAFETY_OVERLAY }),
    medal({ id: 'permits', title: 'Permit to work', text: 'Permits issued with every precaution right', have: p.permits.length, of: PERMIT_JOBS.length, steps: [1, 2, PERMIT_JOBS.length], overlay: SAFETY_OVERLAY }),
    medal({ id: 'rounds', title: 'Eyes and ears', text: 'Most right calls on one operator round', have: p.roundBest, of: CHECKPOINTS.length, steps: [5, 7, CHECKPOINTS.length], overlay: ROUNDS_OVERLAY }),
    medal({ id: 'shifts', title: 'Safe pair of hands', text: 'Stars earned on shifts', have: stars, of: SHIFTS.length * 3, steps: [3, 7, SHIFTS.length * 3], overlay: SHIFT_OVERLAY }),
  ]
}

/** The rank the medals add up to, and how far to the next. */
export function rankOf(list: Medal[]) {
  const points = list.reduce((sum, m) => sum + TIER_POINTS[m.tier], 0)
  const index = RANKS.filter((r) => points >= r.points).length - 1
  return { points, max: list.length * 3, rank: RANKS[index], next: RANKS[index + 1] ?? null }
}
