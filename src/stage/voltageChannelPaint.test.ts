import { describe, expect, it } from 'vitest'
import { strictCanvas } from './strictCanvas'
import { HALF_MEM } from './bilayer'
import { parsePath } from './svgPath'
import {
  BODY_PATHS,
  GATE_PATH,
  drawVoltageChannel,
  ballPathAt,
} from './voltageChannel'
import { chargeRamp, polarityT } from './particleStyle'
import { WASH_PEAK } from './patchScene'
import { REST_MV } from './../core/capacitor'
import { STEPS_MV } from './../core/patchClamp'

const base = {
  cx: 0,
  midY: 0,
  halfHeight: HALF_MEM,
  species: '#facc15',
  speciesDark: '#a16207',
  plug: 0,
  seat: 0,
}

/** How many path segments each traced shape contributes — enough of a
 *  fingerprint to tell which shape a run of drawing calls was. */
const vertexCount = (d: string) =>
  parsePath(d).filter((seg) => seg.kind !== 'close').length

describe('the paint order of the voltage-gated channel', () => {
  it('paints the FLAP over the body, not under it', () => {
    // ⚠ The flap used to go down first, so the protein's dark middle was
    // painted across the end of it: shut, the flap appeared to stop halfway
    // and vanish into the shadow (user, 2026-08-30). Hiding the door is the
    // worst thing this panel can do — it is the door the whole exhibit is
    // about.
    const c = strictCanvas()
    drawVoltageChannel(c.ctx, { ...base, open: 0 })

    // Split the run into paths, and count the vertices in each.
    const runs: number[] = []
    let current = -1
    for (const call of c.calls) {
      if (call === 'beginPath') {
        runs.push(0)
        current = runs.length - 1
        continue
      }
      if (current < 0) continue
      // One count per SEGMENT, matching `vertexCount` — a curve is one call
      // here and one segment there, however many control points it carries.
      if (['moveTo', 'lineTo', 'bezierCurveTo', 'quadraticCurveTo'].includes(call)) {
        runs[current] += 1
      }
    }
    const bodySizes = BODY_PATHS.map(vertexCount)
    const gateSize = vertexCount(GATE_PATH)
    // The three subunits come first, in order, and the flap follows them.
    expect(runs.slice(0, bodySizes.length)).toEqual(bodySizes)
    expect(runs[bodySizes.length]).toBe(gateSize)
  })

  it('never draws a dashed outline anywhere', () => {
    // ⚠ The seat was a yellow dashed halo — an ANNOTATION of the socket rather
    // than the socket (user, 2026-08-30: "remove the yellow dashed outline").
    // It is a dark recess opening in the mouth now, which is the thing itself.
    for (const t of [0, 0.5, 1]) {
      const c = strictCanvas()
      drawVoltageChannel(c.ctx, { ...base, open: t, seat: t, plug: t * 0.4 })
      expect(c.calls).not.toContain('setLineDash')
    }
  })

  it('adds no extra outline when the ball seats', () => {
    // The ring that used to appear said in outline what the ball now says by
    // GOING STILL, which is the mechanism rather than an annotation of it.
    const loose = strictCanvas()
    const seated = strictCanvas()
    drawVoltageChannel(loose.ctx, { ...base, open: 1, seat: 1, plug: 0.5 })
    drawVoltageChannel(seated.ctx, { ...base, open: 1, seat: 1, plug: 1 })
    expect(seated.calls.filter((k) => k === 'stroke').length).toBe(
      loose.calls.filter((k) => k === 'stroke').length,
    )
    // The ball really did move between those two, so this is not comparing a
    // frame with itself.
    expect(ballPathAt(0.5)).not.toEqual(ballPathAt(1))
  })
})

describe('the patch clamp says which way the charge is', () => {
  it('is RED when the inside is positive and BLUE when it is negative', () => {
    // ⚠ The user's expectation, confirmed (2026-08-30: "when I keep charge
    // positive, I expect to see red color-coding"). It is the app's convention
    // everywhere — the neuron scene and the spike graph read off the same
    // ramp — and the clamp was already on it.
    const [r1, g1, b1] = chargeRamp(polarityT(40)).split(',').map(Number)
    expect(r1).toBeGreaterThan(b1)
    expect(r1).toBeGreaterThan(g1)
    const [r2, , b2] = chargeRamp(polarityT(REST_MV)).split(',').map(Number)
    expect(b2).toBeGreaterThan(r2)
    // And nothing at all at zero: the membrane genuinely has no polarity there,
    // so a colour would be a claim the physics does not make.
    expect(polarityT(0)).toBe(0)
  })

  it('turns the ramp up enough that the QUIET end of it still reads', () => {
    // ⚠ The colours were always right; the STRENGTH was the bug. This clamp's
    // steps are −72, 0 and +40 mV, and the wash's alpha is proportional to how
    // far from zero the membrane is — so the red at the top step came out at
    // two-thirds of the blue at rest and barely registered.
    const alpha = (mv: number) => WASH_PEAK * Math.abs(polarityT(mv))
    const top = Math.max(...STEPS_MV.map((mv) => mv))
    expect(top).toBeGreaterThan(0)
    expect(alpha(top)).toBeGreaterThan(0.3)
    // The PROPORTION between them is honest and must stay: a louder ramp, not
    // a flattened one. Red at +40 mV is genuinely a smaller push than blue at
    // rest, and the picture should keep saying so.
    expect(alpha(top)).toBeLessThan(alpha(REST_MV))
  })
})
