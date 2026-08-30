import type { TeachingPara } from './neuron'
import { REST_MV } from './capacitor'
import { nernstMv } from './voltage'
import { restingCounts } from './ions'

// D13 — the patch clamp. HOW WE KNOW.
//
// Every other exhibit in this app draws a smooth curve and asks a child to
// believe it. This one takes the curve apart. A glass pipette is pressed onto
// the membrane until it seals, and what comes back is not a curve at all: it
// is a single channel flicking between shut and open, at random, in square
// steps of about a picoamp. The smooth curves everywhere else are what you get
// when you add thousands of those together.
//
// Two things a child can discover here, neither of them assertable elsewhere:
//
//   • Voltage does not change how BIG an opening is. It changes how OFTEN the
//     channel is open. The step height is the same at every voltage; only the
//     proportion of time spent up there moves. That is what "voltage-gated"
//     actually means, and no smooth curve can show it.
//   • A smooth signal can be made entirely of random square blips. Nothing in
//     the cell is smooth; smoothness is what averaging looks like.
//
// Everything here is a pure function of (channel index, voltage, time), so a
// test can walk it and the picture can be paused — and the randomness is
// SEEDED, never `Math.random`.

/** Single-channel conductance, picosiemens. A delayed-rectifier potassium
 *  channel runs about 10–20 pS; this is the middle of that. */
export const GAMMA_PS = 12

/** Half-activation voltage and slope, mV — the Boltzmann that says how the
 *  open probability climbs with depolarisation. */
export const V_HALF_MV = 10
export const V_SLOPE_MV = 12

/** Mean time the channel stays open once it opens, ms. Real single-channel
 *  openings are a few milliseconds. The CLOSED time is not a second free
 *  parameter — it follows from this and the open probability. */
export const TAU_OPEN_MS = 5

/** How many of these a cell carries. Order of magnitude, declared. */
export const CHANNELS_IN_CELL = 5000

/** The seal a patch pipette makes, in gigaohms — the thing that made the
 *  method possible and won its inventors the Nobel Prize. */
export const SEAL_GOHM = 1

/** The window the oscilloscope shows, ms. */
export const PATCH_WINDOW_MS = 400

/** The voltages the child can step to. Rest, a middling push, and a big one:
 *  three settings a child can tell apart, rather than a slider along a
 *  quantity nobody has a feel for. */
export const STEPS_MV = [REST_MV, 0, 40] as const
export type StepMv = (typeof STEPS_MV)[number]

/** The potassium voltage this patch sits against — DERIVED from the cell's own
 *  concentrations, like everything else in the app. */
export function reversalMv(): number {
  return nernstMv('k', restingCounts())
}

/** How much current one open channel passes at this voltage, in picoamps.
 *  γ(pS) × driving force(mV) / 1000. Positive means potassium leaving. */
export function unitaryPa(vm: number): number {
  return (GAMMA_PS * (vm - reversalMv())) / 1000
}

/** How much of the time the channel is open — a Boltzmann in the voltage.
 *  This is the ONLY thing the voltage changes. */
export function openProbability(vm: number): number {
  return 1 / (1 + Math.exp((V_HALF_MV - vm) / V_SLOPE_MV))
}

/** Mean shut time, ms. Derived from the open time and the open probability,
 *  because Po = τo / (τo + τc) and there is no third number to invent. */
export function meanClosedMs(vm: number): number {
  const po = Math.min(0.999, Math.max(1e-4, openProbability(vm)))
  return (TAU_OPEN_MS * (1 - po)) / po
}

/** Seeded, never `Math.random`: the same channel at the same voltage flickers
 *  the same way every time, so a paused picture stays put and a test can walk
 *  it. */
function hash01(a: number, b: number): number {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453
  return s - Math.floor(s)
}

/** An exponential dwell from a uniform draw: real channel lifetimes are
 *  exponentially distributed, which is what "it has no memory of how long it
 *  has already been open" means. */
const dwellMs = (mean: number, u: number): number =>
  -mean * Math.log(Math.max(1e-6, 1 - u))

export interface Dwell {
  fromMs: number
  toMs: number
  open: boolean
}

/** One channel's whole record over the window: shut and open stretches, back
 *  to back, with no gaps. A channel is always in one state or the other. */
const dwellCache = new Map<string, Dwell[]>()

/** One channel's whole record over the window, memoised. A record is a pure
 *  function of (channel, voltage), so computing it twice is waste — and the
 *  whole-cell sum asks for thousands of them at once. */
export function dwells(index: number, vm: number, windowMs = PATCH_WINDOW_MS): Dwell[] {
  const key = `${index}|${vm}|${windowMs}`
  const hit = dwellCache.get(key)
  if (hit) return hit
  const made = buildDwells(index, vm, windowMs)
  if (dwellCache.size > 40000) dwellCache.clear()
  dwellCache.set(key, made)
  return made
}

function buildDwells(index: number, vm: number, windowMs: number): Dwell[] {
  return dwellsFor(index, openProbability(vm), TAU_OPEN_MS, windowMs)
}

/** THE FLICKER, for any door at all.
 *
 *  Given how much of the time something is open and how long an opening lasts,
 *  this is the record. Pulled out of the patch clamp so the gating-families
 *  bench can use it (2026-08-28) — a channel is a two-state thing whatever
 *  opens it, and a second copy of this would be a second thing to keep true.
 *
 *  Seeded on the index, so the same door flickers the same way every time. */
export function dwellsFor(
  index: number,
  po: number,
  tauOpenMs: number,
  windowMs: number,
): Dwell[] {
  const p = Math.min(0.999, Math.max(1e-4, po))
  const tauO = tauOpenMs
  const tauC = (tauOpenMs * (1 - p)) / p
  const out: Dwell[] = []
  // Start shut, but a fraction of the way into a shut stretch, so the records
  // do not all begin at the same instant.
  let t = -dwellMs(tauC, hash01(index, 0.5))
  let open = false
  let k = 1
  while (t < windowMs && k < 4000) {
    const len = dwellMs(open ? tauO : tauC, hash01(index, k))
    out.push({ fromMs: t, toMs: t + len, open })
    t += len
    open = !open
    k++
  }
  return out
}

/** HOW MUCH OF THE TIME IT WAS ACTUALLY OPEN, read off the record.
 *
 *  Not the model's `po` — the record's own. They differ, because a finite
 *  window of a random process does not land exactly on its own average, and
 *  keeping that disagreement is the point: a child reading "38% open" off a
 *  bar is reading a MEASUREMENT, and measurements wobble. */
export function measuredPo(record: Dwell[], windowMs: number): number {
  let open = 0
  for (const d of record) {
    if (!d.open) continue
    open += Math.min(windowMs, d.toMs) - Math.max(0, d.fromMs)
  }
  return Math.max(0, Math.min(1, open / windowMs))
}

export function openAt(index: number, vm: number, ms: number): boolean {
  for (const d of dwells(index, vm)) {
    if (ms >= d.fromMs && ms < d.toMs) return d.open
  }
  return false
}

/** One channel's current at a moment, picoamps. */
export function channelPa(index: number, vm: number, ms: number): number {
  return openAt(index, vm, ms) ? unitaryPa(vm) : 0
}

/** How many of `n` channels are open at a moment. This is a REAL SUM — every
 *  one of them is flickering on its own seed — not a smooth curve with noise
 *  sprinkled on it. That distinction is the whole exhibit, so it would be a
 *  strange place to cheat. */
export function openCount(vm: number, ms: number, n: number): number {
  let open = 0
  for (let i = 0; i < n; i++) if (openAt(i, vm, ms)) open++
  return open
}

/** The whole-cell current, picoamps: the same sum, over every channel. */
export function wholeCellPa(vm: number, ms: number, n = CHANNELS_IN_CELL): number {
  return openCount(vm, ms, n) * unitaryPa(vm)
}

/** What the sum SETTLES to — N·Po·i, the textbook macroscopic current. The
 *  drawn sum has to hover around this or one of the two is wrong, and a test
 *  says so. */
export function expectedWholeCellPa(vm: number, n = CHANNELS_IN_CELL): number {
  return n * openProbability(vm) * unitaryPa(vm)
}

/** How often an open channel lets a drawn ion through, in window-ms, and how
 *  long one takes to cross. Both are DRAWING rates, declared in the honesty
 *  note: a real 1.5 pA is about nine million ions a second, which is not a
 *  thing anybody can watch. What is honest here is that ions move only while
 *  the door is open, and that they always go the same way. */
export const EMIT_MS = 2
export const FLIGHT_MS = 70

export interface FlyingIon {
  /** Which emission this is, so its wobble is its own and never reshuffles. */
  seed: number
  /** 0 at the mouth, 1 at the far end of the pipette. */
  progress: number
}

/** The ions crossing the channel right now — worked out from the SAME dwell
 *  record the trace is drawn from, so a child can match an ion going through
 *  to a step on the paper. Pure in (voltage, time). */
export function ionsInFlight(vm: number, nowMs: number, index = 0): FlyingIon[] {
  const out: FlyingIon[] = []
  for (const d of dwells(index, vm)) {
    if (!d.open) continue
    if (d.toMs < nowMs - FLIGHT_MS || d.fromMs > nowMs) continue
    const first = Math.ceil(Math.max(d.fromMs, nowMs - FLIGHT_MS) / EMIT_MS) * EMIT_MS
    for (let t = first; t <= Math.min(d.toMs, nowMs); t += EMIT_MS) {
      const progress = (nowMs - t) / FLIGHT_MS
      if (progress >= 0 && progress <= 1) out.push({ seed: Math.round(t / EMIT_MS), progress })
    }
  }
  return out
}

/** How many ions one opening really carries, so the drawing can say how much
 *  it is leaving out. Charge over the elementary charge. */
export const ELEMENTARY_C = 1.602e-19
export function ionsPerSecond(vm: number): number {
  return Math.abs(unitaryPa(vm)) * 1e-12 / ELEMENTARY_C
}

const pa = (v: number) => v.toFixed(2)
const pct = (v: number) => Math.round(v * 100)

export const PATCH_PARTS: TeachingPara[] = [
  {
    icon: '🔬',
    text: 'This is how anybody knows any of it. You pull a glass tube out to a tip finer than a hair, press it against the cell until it sticks — really sticks, a seal so tight almost nothing leaks past it — and then you listen to the little patch of wall trapped inside the tip.',
  },
  {
    icon: '⬛',
    text: 'And what comes back is not a nice smooth curve. It is one channel, opening and shutting on its own, at random, like a door in a draught. Shut, shut, OPEN, shut, OPEN — and every opening is exactly the same size. That is what a single channel actually looks like.',
  },
  {
    icon: '🎚️',
    text: `Now change the voltage and watch what does NOT change: the height of the steps. An opening is the same size at every setting. What changes is how much of the time it is open at all — that is the whole of "voltage-gated". The voltage does not push harder on the door; it makes the door open more often.`,
  },
  {
    icon: '➕',
    text: `Then add them up. Four channels together already look less like steps. Every cell has thousands of them — about ${CHANNELS_IN_CELL.toLocaleString(
      'en-US',
    )} — and thousands of random blips added together make the smooth curve you have seen in every other view in this app. Nothing inside a cell is smooth. Smooth is just what a big crowd of random things looks like from far away.`,
  },
]

export function patchRightNow(vm: number): TeachingPara[] {
  const po = openProbability(vm)
  const i = unitaryPa(vm)
  return [
    {
      icon: vm < -40 ? '😴' : vm < 20 ? '👀' : '🔥',
      text: `At ${vm > 0 ? '+' : ''}${Math.round(vm)} mV this door is open about ${pct(
        po,
      )} of the time. Each time it opens it carries ${pa(
        i,
      )} pA — that is about ${Math.round(
        ionsPerSecond(vm) / 1e6,
      )} million potassium ions a second, which is why the ones drawn going through are a tiny sample of the real traffic.`,
    },
    {
      icon: '📏',
      text: `Compare the step heights: ${STEPS_MV.map(
        (v) => `${pa(unitaryPa(v))} pA at ${v > 0 ? '+' : ''}${v} mV`,
      ).join(', ')}. Nearly the same. Now compare how OFTEN it is open: ${STEPS_MV.map(
        (v) => `${pct(openProbability(v))}%`,
      ).join(', then ')}. That is the difference the voltage makes, and it is the whole of "voltage-gated".`,
    },
  ]
}

export const PATCH_HONESTY: TeachingPara[] = [
  {
    icon: '🧮',
    text: `CALIBRATED: ${GAMMA_PS} pS for one potassium channel is a real measured figure (they run about 10–20), openings really do last a few milliseconds, and the potassium voltage this current is driven against is worked out from the cell's own concentrations rather than typed in. The whole-cell line is a GENUINE SUM of ${CHANNELS_IN_CELL.toLocaleString(
      'en-US',
    )} separately flickering channels — it would be a strange exhibit to cheat in.`,
  },
  {
    icon: '🎲',
    text: 'SEEDED: the flickering is random but repeatable, so pausing does not reshuffle it and the same voltage always gives the same record. A real channel would never repeat itself.',
  },
  {
    icon: '💧',
    text: `EXAGGERATED, and this one matters: the ions you can see going through stand for MILLIONS. One opening at the top setting carries about ${Math.round(
      ionsPerSecond(40) / 1e6,
    )} million potassium ions a second — nobody could watch that, so a handful are drawn instead. What is honest about them is that they move ONLY while the door is open, that they all go the same way (out of the cell, at every setting of this dial), and that they end up in the pipette, which is exactly where a real recording collects them.`,
  },
  {
    icon: '⏱️',
    text: `SLOWED DOWN: the window is ${PATCH_WINDOW_MS} ms of cell time. That part is honest — this is roughly the speed a real recording plays at.`,
  },
  {
    icon: '✂️',
    text: `SIMPLIFIED: a real patch usually catches a few channels rather than exactly one, a real channel has more than two states (there are shut states it has to pass through), and the seal is drawn as a neat cup — in life it is a mess of glass, membrane and luck. The ${SEAL_GOHM} gigaohm seal is the real threshold, though, and getting one is still the hard part of the job.`,
  },
]
