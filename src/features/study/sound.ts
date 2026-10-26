// Sounds made on the spot with Web Audio, so there are no files to download:
// a soft chime when a session ends, and steady background noise to study to.

export type Ambience = 'off' | 'rain' | 'brown' | 'cafe'

export const AMBIENCES: { id: Ambience; name: string }[] = [
  { id: 'off', name: 'Off' },
  { id: 'rain', name: 'Rain' },
  { id: 'brown', name: 'Brown noise' },
  { id: 'cafe', name: 'Café murmur' },
]

let context: AudioContext | null = null

function audio(): AudioContext | null {
  if (typeof window === 'undefined' || !('AudioContext' in window)) return null
  context ??= new AudioContext()
  if (context.state === 'suspended') void context.resume()
  return context
}

/** Three falling notes, like a small bell. */
export function chime(volume = 0.5) {
  const ctx = audio()
  if (!ctx) return
  const notes = [880, 659.25, 523.25]
  notes.forEach((frequency, i) => {
    const at = ctx.currentTime + i * 0.28
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = frequency
    gain.gain.setValueAtTime(0, at)
    gain.gain.linearRampToValueAtTime(0.25 * volume, at + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 1.6)
    osc.connect(gain).connect(ctx.destination)
    osc.start(at)
    osc.stop(at + 1.7)
  })
}

/** Four seconds of noise: white, or brown (each sample a small step from the last). */
function noiseBuffer(ctx: AudioContext, brown: boolean): AudioBuffer {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  let last = 0
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1
    if (brown) {
      last = (last + 0.02 * white) / 1.02
      data[i] = last * 3.5
    } else data[i] = white
  }
  return buffer
}

let playing: { kind: Ambience; gain: GainNode; stop: () => void } | null = null

/** Starts, changes or stops the background sound. */
export function setAmbience(kind: Ambience, volume: number) {
  if (playing?.kind === kind) {
    playing.gain.gain.value = volume
    return
  }
  playing?.stop()
  playing = null
  if (kind === 'off') return
  const ctx = audio()
  if (!ctx) return
  const gain = ctx.createGain()
  gain.gain.value = volume
  gain.connect(ctx.destination)
  const source = ctx.createBufferSource()
  source.buffer = noiseBuffer(ctx, kind === 'brown')
  source.loop = true
  const nodes: AudioNode[] = []
  if (kind === 'rain') {
    // Rain is mostly hiss: white noise with the lowest and highest frequencies taken off, swelling slowly.
    const low = new BiquadFilterNode(ctx, { type: 'highpass', frequency: 500 })
    const high = new BiquadFilterNode(ctx, { type: 'lowpass', frequency: 5000 })
    const swell = ctx.createGain()
    swell.gain.value = 0.35
    const lfo = new OscillatorNode(ctx, { frequency: 0.13 })
    const depth = new GainNode(ctx, { gain: 0.08 })
    lfo.connect(depth).connect(swell.gain)
    lfo.start()
    source.connect(low).connect(high).connect(swell).connect(gain)
    nodes.push(low, high, swell, lfo, depth)
  } else if (kind === 'cafe') {
    // A low murmur: brown noise through the band where voices sit, wavering like a room of conversations.
    source.buffer = noiseBuffer(ctx, true)
    const band = new BiquadFilterNode(ctx, { type: 'bandpass', frequency: 420, Q: 0.7 })
    const waver = ctx.createGain()
    waver.gain.value = 0.9
    const lfo = new OscillatorNode(ctx, { frequency: 0.7 })
    const depth = new GainNode(ctx, { gain: 0.25 })
    lfo.connect(depth).connect(waver.gain)
    lfo.start()
    source.connect(band).connect(waver).connect(gain)
    nodes.push(band, waver, lfo, depth)
  } else {
    source.connect(gain)
  }
  source.start()
  playing = {
    kind,
    gain,
    stop: () => {
      source.stop()
      for (const node of nodes) {
        if (node instanceof OscillatorNode) node.stop()
        node.disconnect()
      }
      gain.disconnect()
    },
  }
}
