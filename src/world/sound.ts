import { getSettings, subscribeSettings } from './settings.ts'

// The house's sounds, all made in the browser with the Web Audio API from
// filtered noise and simple tones: no sound files to download. Each room
// asks for the ambiences it wants (a fire, rain on the window, the fountain,
// the city), which fade in and out as you come and go, and footsteps sound
// on whatever floor you're walking over.

export type AmbienceName = 'fire' | 'rain' | 'fountain' | 'city' | 'birds' | 'wind'
export type Floor = 'wood' | 'carpet' | 'stone' | 'tile'

let ctx: AudioContext | null = null
let master: GainNode | null = null
let noise: AudioBuffer | null = null
let brown: AudioBuffer | null = null

/** Master level from the settings: silent when muted. */
function level() {
  const { soundVolume, muted } = getSettings()
  return muted ? 0 : soundVolume
}

/** Browsers only allow sound after a click or key press, so the engine starts on the first one. */
function start() {
  if (ctx || typeof AudioContext === 'undefined') return
  ctx = new AudioContext()
  master = ctx.createGain()
  master.gain.value = level()
  master.connect(ctx.destination)
  noise = makeNoise(ctx, false)
  brown = makeNoise(ctx, true)
  subscribeSettings(() => master?.gain.setTargetAtTime(level(), ctx!.currentTime, 0.1))
  for (const name of wanted.keys()) setLevel(name, wanted.get(name)!)
}

if (typeof window !== 'undefined') {
  const wake = () => {
    start()
    if (ctx?.state === 'suspended') void ctx.resume()
  }
  window.addEventListener('pointerdown', wake)
  window.addEventListener('keydown', wake)
  // Quiet while the tab is in the background.
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return
    if (document.hidden) void ctx.suspend()
    else void ctx.resume()
  })
}

/** Two seconds of noise to loop: white, or brown (much softer, all rumble). */
function makeNoise(context: AudioContext, isBrown: boolean) {
  const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate)
  const data = buffer.getChannelData(0)
  let last = 0
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1
    if (isBrown) {
      last = (last + 0.02 * white) / 1.02
      data[i] = last * 3.5
    } else data[i] = white
  }
  return buffer
}

function loop(buffer: AudioBuffer) {
  const source = ctx!.createBufferSource()
  source.buffer = buffer
  source.loop = true
  // Start each loop somewhere different so layered beds don't phase together.
  source.start(0, Math.random() * 2)
  return source
}

function filter(type: BiquadFilterType, frequency: number, q = 0.7) {
  const f = ctx!.createBiquadFilter()
  f.type = type
  f.frequency.value = frequency
  f.Q.value = q
  return f
}

function gain(value: number) {
  const g = ctx!.createGain()
  g.gain.value = value
  return g
}

/** A short burst of filtered noise with a fast decay: a crackle, a splash, a footstep. */
function burst(
  out: AudioNode,
  at: number,
  {
    freq,
    q = 1,
    length,
    peak,
    type = 'bandpass' as BiquadFilterType,
  }: { freq: number; q?: number; length: number; peak: number; type?: BiquadFilterType },
) {
  const source = ctx!.createBufferSource()
  source.buffer = noise
  const f = filter(type, freq, q)
  const env = gain(0)
  env.gain.setValueAtTime(0, at)
  env.gain.linearRampToValueAtTime(peak, at + 0.004)
  env.gain.exponentialRampToValueAtTime(0.0001, at + length)
  source.connect(f).connect(env).connect(out)
  source.start(at, Math.random() * 1.5, length + 0.05)
}

interface Bed {
  out: GainNode
  stop: () => void
}

/** Builds one ambience. Each returns its output node (silent until faded in) and a way to stop its timers. */
const BUILDERS: Record<AmbienceName, () => Bed> = {
  // A low roar from brown noise, with crackles and the odd pop scattered over it.
  fire() {
    const out = gain(0)
    loop(brown!).connect(filter('lowpass', 500)).connect(gain(0.5)).connect(out)
    const crackles = gain(1)
    crackles.connect(out)
    let timer = 0
    const tick = () => {
      const t = ctx!.currentTime
      const n = 1 + Math.floor(Math.random() * 3)
      for (let i = 0; i < n; i++)
        burst(crackles, t + Math.random() * 0.08, {
          freq: 1800 + Math.random() * 3000,
          q: 2,
          length: 0.02 + Math.random() * 0.05,
          peak: 0.15 + Math.random() * 0.35,
        })
      if (Math.random() < 0.08) burst(crackles, t + 0.1, { freq: 700, q: 1, length: 0.12, peak: 0.6 })
      timer = window.setTimeout(tick, 60 + Math.random() * 350)
    }
    tick()
    return { out, stop: () => clearTimeout(timer) }
  },
  // Steady rain against glass: high hiss over a soft wash.
  rain() {
    const out = gain(0)
    loop(noise!)
      .connect(filter('bandpass', 4000, 0.4))
      .connect(gain(0.12))
      .connect(out)
    loop(brown!).connect(filter('lowpass', 900)).connect(gain(0.35)).connect(out)
    let timer = 0
    const tick = () => {
      burst(out, ctx!.currentTime, { freq: 5000 + Math.random() * 3000, q: 3, length: 0.015, peak: 0.12 })
      timer = window.setTimeout(tick, 20 + Math.random() * 90)
    }
    tick()
    return { out, stop: () => clearTimeout(timer) }
  },
  // Falling water: broad noise whose loudness wanders, with splashes.
  fountain() {
    const out = gain(0)
    const wobble = gain(0.5)
    loop(noise!)
      .connect(filter('bandpass', 1400, 0.5))
      .connect(wobble)
      .connect(out)
    loop(brown!).connect(filter('lowpass', 700)).connect(gain(0.6)).connect(out)
    let timer = 0
    const tick = () => {
      const t = ctx!.currentTime
      wobble.gain.setTargetAtTime(0.35 + Math.random() * 0.3, t, 0.15)
      burst(out, t + Math.random() * 0.1, { freq: 900 + Math.random() * 2500, q: 1.5, length: 0.08, peak: 0.12 })
      timer = window.setTimeout(tick, 80 + Math.random() * 160)
    }
    tick()
    return { out, stop: () => clearTimeout(timer) }
  },
  // A distant city: low traffic rumble, and now and then a car passing far off.
  city() {
    const out = gain(0)
    loop(brown!).connect(filter('lowpass', 260)).connect(gain(0.9)).connect(out)
    const swell = gain(0)
    loop(noise!)
      .connect(filter('bandpass', 500, 0.8))
      .connect(swell)
      .connect(out)
    let timer = 0
    const tick = () => {
      const t = ctx!.currentTime
      const length = 3 + Math.random() * 4
      swell.gain.setTargetAtTime(0.04 + Math.random() * 0.05, t, length / 4)
      swell.gain.setTargetAtTime(0, t + length / 2, length / 4)
      timer = window.setTimeout(tick, (length + Math.random() * 6) * 1000)
    }
    tick()
    return { out, stop: () => clearTimeout(timer) }
  },
  // Songbirds in the garden by day: little falling and rising chirps.
  birds() {
    const out = gain(0)
    let timer = 0
    const chirp = (at: number) => {
      const osc = ctx!.createOscillator()
      const env = gain(0)
      const f = 2600 + Math.random() * 2400
      osc.frequency.setValueAtTime(f, at)
      osc.frequency.exponentialRampToValueAtTime(f * (Math.random() < 0.5 ? 0.7 : 1.3), at + 0.08)
      env.gain.setValueAtTime(0, at)
      env.gain.linearRampToValueAtTime(0.05, at + 0.01)
      env.gain.exponentialRampToValueAtTime(0.0001, at + 0.1)
      osc.connect(env).connect(out)
      osc.start(at)
      osc.stop(at + 0.12)
    }
    const tick = () => {
      const t = ctx!.currentTime
      const n = 2 + Math.floor(Math.random() * 5)
      for (let i = 0; i < n; i++) chirp(t + i * (0.09 + Math.random() * 0.06))
      timer = window.setTimeout(tick, 1500 + Math.random() * 5000)
    }
    tick()
    return { out, stop: () => clearTimeout(timer) }
  },
  // Air moving round the dome: a slow, breathy whistle.
  wind() {
    const out = gain(0)
    const band = filter('bandpass', 600, 3)
    loop(noise!).connect(band).connect(gain(0.25)).connect(out)
    let timer = 0
    const tick = () => {
      band.frequency.setTargetAtTime(350 + Math.random() * 600, ctx!.currentTime, 1.5)
      timer = window.setTimeout(tick, 2500)
    }
    tick()
    return { out, stop: () => clearTimeout(timer) }
  },
}

const beds = new Map<AmbienceName, Bed>()
/** The level each ambience should be at, kept even before the engine starts. */
const wanted = new Map<AmbienceName, number>()

/** Fades an ambience to `value` (0 to 1), starting it if needed and stopping it once silent. */
export function setLevel(name: AmbienceName, value: number) {
  wanted.set(name, value)
  if (!ctx || !master) return
  let bed = beds.get(name)
  if (!bed && value <= 0) return
  if (!bed) {
    bed = BUILDERS[name]()
    bed.out.connect(master)
    beds.set(name, bed)
  }
  bed.out.gain.setTargetAtTime(value, ctx.currentTime, 0.4)
  if (value <= 0) {
    const ending = bed
    window.setTimeout(() => {
      if ((wanted.get(name) ?? 0) > 0 || beds.get(name) !== ending) return
      ending.stop()
      ending.out.disconnect()
      beds.delete(name)
    }, 3000)
  }
}

const STEP: Record<Floor, { freq: number; q: number; length: number; peak: number }> = {
  wood: { freq: 380, q: 1.2, length: 0.09, peak: 0.5 },
  carpet: { freq: 220, q: 0.8, length: 0.07, peak: 0.25 },
  stone: { freq: 1500, q: 1.4, length: 0.06, peak: 0.35 },
  tile: { freq: 2200, q: 2, length: 0.05, peak: 0.3 },
}

/** One footstep on this kind of floor, a little different every time. */
export function footstep(floor: Floor, running: boolean) {
  if (!ctx || !master || ctx.state !== 'running') return
  const s = STEP[floor]
  const vary = 0.85 + Math.random() * 0.3
  burst(master, ctx.currentTime, { ...s, freq: s.freq * vary, peak: s.peak * (running ? 1.3 : 1) * 0.5, type: 'bandpass' })
  if (floor === 'wood') burst(master, ctx.currentTime + 0.012, { freq: 140, q: 1, length: 0.06, peak: 0.25, type: 'lowpass' })
}
