// HOW A CURRENT LOOKS COMING OUT OF A PORE — one model, for every view.
//
// ⚠ REPLACES THE OLD "n ions, evenly phased" DRAWING (user, 2026-08-30: "AP
// does not work still. Remove current ion flow implementation. Replace it with
// a new current view, which looks as the flow seen in 'Patch clamp
// recording'").
//
// The patch clamp already had the right idea and had had it for a while: it
// emits one drawn ion every couple of milliseconds while the door is open and
// lets each fly for seventy — about **thirty-five in the air at once**, fanning
// out and fading as they leave. That reads as a current. Everything else in the
// app was drawing a handful of balls, which reads as a queue of individuals,
// and no amount of tuning that handful fixed it.
//
// ⚠ THE HONEST BIT, unchanged from the patch clamp's own note: these are
// DRAWING rates. A single open sodium channel carries about 7.5 million ions a
// second, which nobody can watch. What is honest is that ions move only while
// the door is open, that they always go the way their gradient points, and that
// a busier door visibly carries more.

/** How many are in the air at once when a pore is as busy as this app draws.
 *  The patch clamp's own figure: 70 ms of flight at one every 2 ms. */
export const FLOW_IN_FLIGHT = 35

export interface Flying {
  /** Stable for the whole of one ion's journey, so anything seeded off it —
   *  its sideways wander — never reshuffles mid-flight. */
  seed: number
  /** 0 at the pore's mouth, 1 at the end of its journey. */
  progress: number
}

/** The ions in flight through a pore running at `rate` (0→1 of the busiest the
 *  app draws), given a CLOCK that counts journeys.
 *
 *  The clock is deliberately not wall time: a view that measures charge can
 *  pass charge-per-ion, and then an ion appears for every unit of charge
 *  delivered rather than for every tick — which is the honest thing to tie a
 *  current to. A view with nothing better can pass elapsed time.
 *
 *  Each ion keeps the emission index it was born with, so the queue moves
 *  continuously: nothing teleports when the rate changes, it just thins. */
export function flowAt(
  rate: number,
  clock: number,
  /** How many fit end to end in THIS view's journey — a fact about its
   *  geometry, not a second opinion about how dense a current is. The lens
   *  spans a pipette's length and takes the full crowd; the neuron scene's
   *  ions travel a few membrane-thicknesses and would overlap into a bar. */
  inFlight = FLOW_IN_FLIGHT,
): Flying[] {
  const r = Math.max(0, Math.min(1, rate))
  if (r <= 0.001 || !Number.isFinite(clock)) return []
  const n = Math.max(1, Math.round(Math.min(FLOW_IN_FLIGHT, inFlight) * r))
  const head = clock * n
  if (!Number.isFinite(head)) return []
  const out: Flying[] = []
  for (let i = 0; i < n; i++) {
    const born = Math.floor(head) - i
    const progress = (head - born) / n
    if (progress < 0 || progress > 1) continue
    out.push({ seed: born, progress })
  }
  return out
}

/** The sideways wander of one ion, as a fraction of a pore's half-width.
 *
 *  Zero at the mouth and growing as it leaves: a pore is barely wider than an
 *  ion, so nothing spreads INSIDE it — the plume opens once they are out. */
export function flowSpread(ion: Flying): number {
  return Math.sin(ion.seed * 12.9898) * ion.progress
}

/** How solid one ion is at this point of its journey — full as it leaves the
 *  pore, gone by the time it is lost in the crowd. */
export function flowFade(ion: Flying): number {
  return Math.max(0, 1 - ion.progress ** 3)
}
