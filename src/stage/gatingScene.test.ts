import { describe, expect, it } from 'vitest'
import { strictCanvas } from './strictCanvas'
import { leakHalfWidth } from './leakChannel'
import { HALF_MEM, PX_PER_NM } from './bilayer'
import {
  PANEL_W,
  WALL_SCALE,
  WALL_Y,
  channelHalfWidthAt,
  drawFamilyPanel,
  showsCharge,
  opennessAt,
  panelTerm,
  wallGapAt,
} from './gatingScene'
import { ligandHalfWidth } from './ligandChannel'
import { drawVoltageChannel } from './voltageChannel'
import { mechanicalHalfWidth } from './mechanicalChannel'
import { IONS } from '../core/ions'
import { GLOSSY_COLORS } from './particleStyle'
import {
  FAMILIES,
  POKE_MS,
  ballInAt,
  boundAt,
  gateOpennessAt,
  seatOpenAt,
  sensorOutAt,
  ligandLockedAt,
  GATING_HONESTY,
  isGated,
  pokeAt,
  type FamilyId,
} from '../core/gating'

describe('four doors, four panels', () => {
  it('draws every family, poked and unpoked, with real colours', () => {
    for (const f of FAMILIES) {
      for (const since of [null, 0, POKE_MS * 0.25, POKE_MS * 0.6, POKE_MS]) {
        const c = strictCanvas()
        drawFamilyPanel(c.ctx, f.id, since, 1200)
        expect(c.calls.length).toBeGreaterThan(20)
      }
    }
  })

  it('leaves the LEAK open whatever happens to it', () => {
    // The control case, and the reason "gated" means anything: no gate, so
    // nothing opens or shuts it.
    for (const since of [null, 0, POKE_MS * 0.5, POKE_MS * 2]) {
      expect(opennessAt('leak', since)).toBe(1)
    }
    expect(isGated('leak')).toBe(false)
  })

  it('keeps a gated door shut until its own cause arrives', () => {
    for (const f of FAMILIES.filter((x) => isGated(x.id))) {
      // At rest a gated door is SHUT. It is a mechanism, not odds: nothing is
      // pushing on it, so nothing is open (2026-08-28).
      expect(opennessAt(f.id, null)).toBe(0)
    }
  })

  it('opens it while the cause is being applied', () => {
    for (const f of FAMILIES.filter((x) => isGated(x.id))) {
      // Applied → opens → holds → shuts, and then it can be applied again.
      expect(opennessAt(f.id, POKE_MS * 0.05)).toBe(0)
      expect(opennessAt(f.id, POKE_MS * 0.5)).toBe(1)
      expect(opennessAt(f.id, POKE_MS * 0.99)).toBe(0)
    }
  })

  it('has a name to pronounce for every door, and writes none of them on the canvas', () => {
    // ⚠ The words moved to the heading (user, 2026-08-30). Each panel is about
    // a hand's width, and three stacked terms plus an open/shut caption were
    // competing with the only thing the panel is for.
    for (const f of FAMILIES) {
      expect(panelTerm(f.id as FamilyId).length).toBeGreaterThan(3)
    }
    const c = strictCanvas()
    drawFamilyPanel(c.ctx, 'voltage', POKE_MS * 0.5, 1200)
    expect(c.calls).not.toContain('fillText')
    expect(c.calls).not.toContain('strokeText')
  })

  it('tints each door by the ION IT PASSES, not by its family', () => {
    // The app's own rule, and the reference figure's logic: colour means
    // SPECIES (2026-08-28). The rule is unchanged; what changed is the ligand
    // panel's EXEMPLAR (user, 2026-08-30). It was a sodium receptor, which
    // made it the same yellow as the voltage door AND the same yellow as the
    // ion arriving to open it. It is now a GABA-A receptor, which really does
    // pass chloride — so it is green because of what goes through it, exactly
    // like the other three.
    //
    // ⚠ The invariant that actually matters is NOT "which colours differ" —
    // it is that a door's colour is the colour of its own traffic. Pinning the
    // colours alone would let a future family be tinted by taste and still
    // pass. So: every family's tint is a real ion, and it is the ion the panel
    // draws going through it.
    for (const f of FAMILIES) {
      expect(Object.keys(IONS)).toContain(f.tint)
      expect(GLOSSY_COLORS[f.tint]).toBeTruthy()
    }
    // And with the exemplars now chosen, all four doors differ — which is what
    // the rule bought here, without the rule being bent.
    expect(new Set(FAMILIES.map((f) => f.tint)).size).toBe(FAMILIES.length)
  })
})

describe('the mechanics, not the odds', () => {
  it('runs applied → opens → holds → shuts, and can be applied again', () => {
    // The whole shape of the demo (user, 2026-08-28). No flicker, no
    // percentage: how OFTEN is the patch clamp's question, and two exhibits
    // answering the same one is one too many.
    const at = (t: number) => opennessAt('voltage', POKE_MS * t)
    expect(at(0.05)).toBe(0) // the cause is still on its way
    expect(at(0.5)).toBe(1) // held open
    expect(at(0.99)).toBe(0) // shut again
    expect(opennessAt('voltage', null)).toBe(0) // and ready to be poked afresh
  })

  it('opens and shuts SMOOTHLY, never as a jump', () => {
    // A door that teleports between shut and open is a light switch, not a
    // door. Walk the poke and check no single step moves it more than a
    // fraction.
    let biggest = 0
    let last = opennessAt('voltage', 0)
    for (let t = 0; t <= 1; t += 0.01) {
      const now = opennessAt('voltage', POKE_MS * t)
      biggest = Math.max(biggest, Math.abs(now - last))
      last = now
    }
    expect(biggest).toBeLessThan(0.2)
  })

  it('plugs the pore WHILE the door is still open — the third state', () => {
    // ⚠ The user's drawing gives three states: closed, open, INACTIVE. The
    // ball has to arrive while the channel is still conducting, or it reads
    // as a decoration following the door rather than as the thing that stops
    // it (2026-08-29).
    const ball = (t: number) => ballInAt(pokeAt(POKE_MS * t))
    const open = (t: number) => opennessAt('voltage', POKE_MS * t)
    expect(ball(0.5)).toBe(0)
    expect(open(0.5)).toBe(1)
    // Seated, and the door has not shut yet.
    expect(ball(0.75)).toBeCloseTo(1, 2)
    expect(open(0.75)).toBeGreaterThan(0)
    // Gone again before the next go.
    expect(ball(1)).toBeCloseTo(0, 2)
  })

  it('keeps the messenger SEATED for as long as the door is open', () => {
    // A ligand that faded out mid-run would be saying the door stays open
    // with nothing holding it (user, 2026-08-28).
    const bound = (t: number) => boundAt(pokeAt(POKE_MS * t))
    const open = (t: number) => opennessAt('ligand', POKE_MS * t)
    for (let t = 0.3; t <= 0.74; t += 0.02) {
      if (open(t) > 0) expect(bound(t)).toBeCloseTo(1, 2)
    }
    // In before the door opens, and gone only after it has shut. Read off the
    // run rather than sampled at a fixed t — the whole demo was slowed
    // (2026-08-30) and a hardcoded moment tests the old clock, not the rule.
    let opens = 1
    for (let t = 0; t <= 1; t += 0.002) {
      if (open(t) > 0) {
        opens = t
        break
      }
    }
    expect(bound(opens)).toBeCloseTo(1, 2)
    // And it was already fully seated a beat BEFORE that, so the landing and
    // the opening read as cause and consequence rather than one event.
    expect(bound(opens - 0.04)).toBeCloseTo(1, 2)
    expect(bound(1)).toBeCloseTo(0, 2)
    expect(open(1)).toBe(0)
  })
})

describe('the leak has its own shape', () => {
  it('draws the traced outline rather than the gated one', () => {
    // ⚠ A leak channel is not a gate with the gate left out (user,
    // 2026-08-29). It has no gate, no sensor and no binding site — three
    // subunits shoulder to shoulder with a way through that is always there.
    // The traced outline is beziers, so the panel must be drawing curves it
    // does not draw for the gated silhouette's simpler body.
    const leak = strictCanvas()
    drawFamilyPanel(leak.ctx, 'leak', null, 500)
    expect(leak.calls).toContain('bezierCurveTo')
    expect(leak.calls.filter((k) => k === 'closePath').length).toBeGreaterThanOrEqual(3)
  })

  it('cuts a gap in the wall wide enough for it', () => {
    // The traced shape is wider than the drawn gate; one fixed gap would
    // leave lipids standing inside the protein.
    expect(leakHalfWidth(HALF_MEM)).toBeGreaterThan(1.5 * PX_PER_NM)
  })

  it('is tinted with the ion it passes, like every channel here', () => {
    const leak = FAMILIES.find((f) => f.id === 'leak')!
    expect(leak.tint).toBe('k')
  })
})

describe('what opens a voltage-gated door, in the order it happens', () => {
  // ⚠ THE ONLY CHARGE-DRIVEN STEP IS THE SENSOR (user, 2026-08-30: "validate:
  // 'ball' and 'plug' react to charge change, correct?"). They do not. The
  // ball is the hydrophobic IFM motif; it has no useful charge and its landing
  // site is buried until the gate opens. Inactivation borrows its whole
  // voltage dependence from activation.
  //
  // These tests pin the CHAIN, because the chain is the answer to the child's
  // question and it is the thing an edit could silently collapse.
  const at = (t: number) => pokeAt(POKE_MS * t)

  it('moves the sensor before the gate, and the gate before the ball', () => {
    const firstAbove = (f: (t: number) => number) => {
      for (let t = 0; t <= 1; t += 0.002) if (f(t) > 0.001) return t
      return Infinity
    }
    const sensor = firstAbove((t) => sensorOutAt(at(t)))
    const gate = firstAbove((t) => gateOpennessAt(at(t)))
    const seat = firstAbove((t) => seatOpenAt(at(t)))
    const ballT = firstAbove((t) => ballInAt(at(t)))
    expect(sensor).toBeLessThan(gate)
    expect(gate).toBeLessThan(seat)
    expect(seat).toBeLessThan(ballT)
    // And the charge itself comes before all of them — it is what shoves the
    // sensor, and nothing else on the panel it touches.
    expect(firstAbove((t) => at(t).contact)).toBeLessThanOrEqual(sensor)
  })

  it('leaves a clear GAP between the sensor moving and the gate moving', () => {
    // The two used to overlap, which let them read as one event ("the charge
    // opens the door") and left the sensor looking decorative. The pause is
    // what makes the chain legible, so it is pinned.
    let sensorDone = Infinity
    for (let t = 0; t <= 1; t += 0.002) {
      if (sensorOutAt(at(t)) >= 0.999) {
        sensorDone = t
        break
      }
    }
    let gateStarts = Infinity
    for (let t = 0; t <= 1; t += 0.002) {
      if (gateOpennessAt(at(t)) > 0.001) {
        gateStarts = t
        break
      }
    }
    expect(gateStarts).toBeGreaterThanOrEqual(sensorDone)
  })

  it('gives the ball nowhere to land until the door is open', () => {
    // The whole answer to "what pulls the ball in": nothing does. Every moment
    // the ball is on its way IN, the seat must already be there.
    //
    // Only on the way in. Once it is seated the seat is OCCUPIED, not absent,
    // and the gate shutting underneath it does not evict it — the ball leaves
    // on its own clock as the channel recovers. Asserting over the whole run
    // caught exactly that and was the test being wrong, not the model.
    let previous = 0
    for (let t = 0; t <= 1; t += 0.002) {
      const now = ballInAt(at(t))
      if (now > previous + 1e-9) expect(seatOpenAt(at(t))).toBeGreaterThan(0)
      previous = now
    }
    // And the seat is never offered while the gate is shut.
    for (let t = 0; t <= 1; t += 0.002) {
      if (seatOpenAt(at(t)) > 0) expect(gateOpennessAt(at(t))).toBeGreaterThan(0.35)
    }
  })

  it('takes the sensor back out with the charge, not with the gate', () => {
    // It is the thing the field acts on, so it follows the field. If it
    // followed the gate it would be a second drawing of the gate.
    // At 0.8 the gate is already swinging shut — inactivated — while the
    // charge is still flipped and the sensor is therefore still fully out.
    // The two being out of step is the whole point: if the sensor tracked the
    // gate it would just be a second drawing of the gate.
    const late = at(0.8)
    expect(sensorOutAt(late)).toBeCloseTo(1, 2)
    expect(gateOpennessAt(late)).toBeLessThan(1)
    expect(gateOpennessAt(late)).toBeGreaterThan(0)
    expect(late.strength).toBe(1)
    // And it goes home only once the charge does.
    expect(sensorOutAt(at(0.99))).toBeCloseTo(0, 1)
  })
})

describe('no hole in the wall', () => {
  // ⚠ The two separating channels cut their FULLY-OPEN width out of the
  // bilayer and then spent most of the run shut inside it, leaving bare gaps
  // either side of the protein (user, 2026-08-30: "ligand-gated and
  // mechanically-gated have a visual hole in the membrane, place lipids
  // there"). The gap is now cut to the SHUT width and the neighbours are
  // shoved aside as it widens.
  const ids = [
    ['ligand', ligandHalfWidth],
    ['mechanical', mechanicalHalfWidth],
  ] as const

  /** Path vertices sitting in the membrane band, at this distance from the
   *  pore's centre — which is where a lipid would be if one were there. */
  const inBand = (id: FamilyId, since: number | null, from: number, to: number) => {
    const c = strictCanvas()
    drawFamilyPanel(c.ctx, id, since, 1200)
    return c.points.filter((p) => {
      const dx = Math.abs(p.x - PANEL_W / 2)
      return dx >= from && dx <= to && Math.abs(p.y - WALL_Y) < 26
    }).length
  }

  it('cuts the gap to the SHUT width, which is where the bug was', () => {
    // ⚠ A first version of this test only looked at the picture — whether any
    // lipid vertex fell in the band that used to be bare — and it PASSED with
    // the bug put back, because the band was wide enough to catch the first
    // molecule beyond the too-wide gap as well. The fault was in which number
    // gets cut, so the number is what gets pinned. Reverting `wallGapAt` to
    // the open width fails this immediately.
    for (const [id, halfWidth] of ids) {
      expect(wallGapAt(id)).toBeCloseTo(halfWidth(HALF_MEM, 0) * 1.06, 6)
      expect(wallGapAt(id)).toBeLessThan(halfWidth(HALF_MEM, 1))
    }
    // The two that do not widen are unaffected: their gap already fitted.
    for (const id of ['leak', 'voltage'] as const) {
      expect(wallGapAt(id)).toBeGreaterThan(channelHalfWidthAt(id, 1))
    }
  })

  it('really does stand lipids in the band that used to be bare', () => {
    // The picture-level half of it: with the gap cut shut-width, molecules are
    // drawn between the shut protein's edge and where the open one will reach.
    for (const [id, halfWidth] of ids) {
      const from = wallGapAt(id) * WALL_SCALE
      const to = halfWidth(HALF_MEM, 1) * WALL_SCALE * 1.3
      expect(inBand(id, null, from, to)).toBeGreaterThan(0)
    }
  })

  it('shoves them aside as the door opens instead of deleting them', () => {
    // A gap that simply grew would make molecules disappear at its edge. They
    // have to MOVE — so the count near the wall must not drop when it opens.
    for (const [id] of ids) {
      const c = strictCanvas()
      drawFamilyPanel(c.ctx, id, null, 1200)
      const shut = c.points.filter((p) => Math.abs(p.y - WALL_Y) < 26).length
      const o = strictCanvas()
      drawFamilyPanel(o.ctx, id, POKE_MS * 0.55, 1200)
      const open = o.points.filter((p) => Math.abs(p.y - WALL_Y) < 26).length
      expect(opennessAt(id, POKE_MS * 0.55)).toBeGreaterThan(0.9)
      expect(open).toBeGreaterThanOrEqual(shut * 0.9)
    }
  })

  it('never lets the pore be narrower open than shut', () => {
    for (const [, halfWidth] of ids) {
      expect(halfWidth(HALF_MEM, 1)).toBeGreaterThan(halfWidth(HALF_MEM, 0))
      // And it grows smoothly, so the gap never jumps.
      let prev = halfWidth(HALF_MEM, 0)
      for (let o = 0.05; o <= 1; o += 0.05) {
        const now = halfWidth(HALF_MEM, o)
        expect(now).toBeGreaterThanOrEqual(prev)
        expect(now - prev).toBeLessThan(0.4)
        prev = now
      }
    }
  })
})

describe('the signal arrives, it is not a picture of a signal', () => {
  // ⚠ The first cut drew a lightning-bolt zig-zag — a SYMBOL for electricity
  // sitting on the canvas (user, 2026-08-30: "display signal as flash, not a
  // flash icon"). The app already has one way of saying "the signal is here",
  // the yellow bloom the axon views use, and a second private idiom for the
  // same idea is how one visual language stops being one.
  const atStrike = () => {
    const c = strictCanvas()
    drawFamilyPanel(c.ctx, 'voltage', POKE_MS * 0.24, 1200)
    return c
  }

  it('comes in from ABOVE the panel, so it reads as arriving from elsewhere', () => {
    // The blooms are centred beyond the top edge: the light has somewhere to
    // come from rather than being generated inside the frame by the button.
    const lit = atStrike()
    expect(lit.points.some((p) => p.y < 0)).toBe(true)
    // And at rest there is nothing up there at all.
    const rest = strictCanvas()
    drawFamilyPanel(rest.ctx, 'voltage', null, 1200)
    expect(rest.points.some((p) => p.y < 0)).toBe(false)
  })

  it('is over well before the door has finished its business', () => {
    // A flash that lingered would stop being an arrival and become a state.
    const late = strictCanvas()
    drawFamilyPanel(late.ctx, 'voltage', POKE_MS * 0.7, 1200)
    expect(late.points.some((p) => p.y < 0)).toBe(false)
    expect(opennessAt('voltage', POKE_MS * 0.7)).toBe(1)
  })

  it('never draws it on a door that does not listen for it', () => {
    for (const id of ['leak', 'ligand', 'mechanical'] as const) {
      const c = strictCanvas()
      drawFamilyPanel(c.ctx, id, POKE_MS * 0.24, 1200)
      expect(c.points.some((p) => p.y < 0)).toBe(false)
    }
  })
})

describe('only the channels that inactivate get a ball', () => {
  it('suppresses the ball and its seat when asked', () => {
    // ⚠ The axon's delayed rectifier repolarises the spike by STAYING open,
    // and the patch clamp's model is two-state with no inactivation in it at
    // all. A ball on those would be a mechanism the record visibly never
    // performs (user, 2026-08-30).
    const withBall = strictCanvas()
    const without = strictCanvas()
    const base = {
      cx: 0,
      midY: 0,
      halfHeight: HALF_MEM,
      species: '#a78bfa',
      speciesDark: '#6d28d9',
      open: 1,
      plug: 1,
      seat: 1,
    }
    drawVoltageChannel(withBall.ctx, base)
    drawVoltageChannel(without.ctx, { ...base, ball: false })
    expect(without.points.length).toBeLessThan(withBall.points.length)
    // The pore, the flap and the sensor are all still there — only the ball
    // and the seat it lands in are gone.
    expect(without.calls.filter((k) => k === 'fill').length).toBeGreaterThanOrEqual(3)
  })
})

describe('the pace of a run, and the pauses in it', () => {
  const at = (t: number) => pokeAt(POKE_MS * t)
  const firstAbove = (f: (t: number) => number, level = 0.001) => {
    for (let t = 0; t <= 1; t += 0.001) if (f(t) > level) return t
    return Infinity
  }
  const done = (f: (t: number) => number) => {
    for (let t = 0; t <= 1; t += 0.001) if (f(t) >= 0.999) return t
    return Infinity
  }

  it('is slow enough for five events to be seen one at a time', () => {
    // ⚠ Slowed twice (user, 2026-08-30). At 3.6 s the gaps that make the chain
    // a chain were shorter than the eye takes to notice something has stopped.
    expect(POKE_MS).toBeGreaterThanOrEqual(5500)
  })

  it('runs the flash and the depolarisation as ONE event, with no pause', () => {
    // The flash IS the depolarisation arriving; a gap between them would
    // invent a delay that does not exist (user: "flash — depolarization
    // (consequent, no pause)"). They share a single ramp, so there is no
    // moment where one has happened and the other has not.
    for (let t = 0; t <= 1; t += 0.002) {
      expect(at(t).contact).toBeCloseTo(at(t).strength, 9)
    }
  })

  it('leaves a real pause between each cause and its consequence', () => {
    // Measured in MILLISECONDS, not in fractions — a fraction of a run whose
    // length changes is not a pause anybody can see. Each gap has to be long
    // enough to read as "and then".
    const charge = done((t) => at(t).strength)
    const sensor = firstAbove((t) => sensorOutAt(at(t)))
    const sensorDone = done((t) => sensorOutAt(at(t)))
    const gate = firstAbove((t) => gateOpennessAt(at(t)))
    const gateDone = done((t) => gateOpennessAt(at(t)))
    const ball = firstAbove((t) => ballInAt(at(t)))
    const gaps = [
      ['charge → sensor', (sensor - charge) * POKE_MS],
      ['sensor → gate', (gate - sensorDone) * POKE_MS],
      ['gate → ball', (ball - gateDone) * POKE_MS],
    ] as const
    for (const [name, ms] of gaps) {
      expect(`${name}: ${Math.round(ms)}ms`).toBe(`${name}: ${Math.round(ms)}ms`)
      expect(ms).toBeGreaterThanOrEqual(300)
    }
  })

  it('gives the messenger the whole of its arrival to travel', () => {
    // It used to cover the distance in the first third and then hover by the
    // socket waiting for the clock — a jump followed by a stall (user,
    // 2026-08-30: "ion in ligand-gated should move slower").
    const rise = done((t) => boundAt(at(t))) - firstAbove((t) => boundAt(at(t)))
    expect(rise * POKE_MS).toBeGreaterThan(1200)
  })
})

describe('charge is drawn only where charge matters', () => {
  it('marks the two faces on the voltage panel and nowhere else', () => {
    // ⚠ This REVERSES an earlier decision (user, 2026-08-30: "keep charge
    // labels in voltage-gated only, to emphasize the fact that charge is
    // irrelevant in other cases"). The old reason is still true — every
    // membrane is charged — so the point it gave up is now made in words in
    // the info block instead, and the test checks BOTH halves.
    expect(showsCharge('voltage')).toBe(true)
    for (const id of ['leak', 'ligand', 'mechanical'] as const) {
      expect(showsCharge(id)).toBe(false)
    }
    const said = GATING_HONESTY.map((p) => p.text).join(' ')
    expect(said).toMatch(/every membrane is charged/i)
  })
})

describe('the ball is always trying', () => {
  const base = {
    cx: 0,
    midY: 0,
    halfHeight: HALF_MEM,
    species: '#facc15',
    speciesDark: '#a16207',
    open: 0,
    seat: 0,
  }
  const drawn = (plug: number, ms: number) => {
    const c = strictCanvas()
    drawVoltageChannel(c.ctx, { ...base, plug, restlessMs: ms })
    return c.points
  }

  it('jostles on its tether while it is loose', () => {
    // ⚠ Nothing pulls it in (user, twice: "what makes ball swing?"). Drawn
    // still, its sudden move looked caused — and the only cause on the panel
    // is the charge, so the charge is what a child concluded. Jostling from
    // the first frame, the picture answers the question by itself.
    const a = drawn(0, 0)
    const b = drawn(0, 240)
    expect(a.length).toBe(b.length)
    expect(a).not.toEqual(b)
  })

  it('goes STILL the moment it is seated', () => {
    // A ball that kept twitching in its socket would be saying it had not
    // really bound — which is the opposite of what inactivation is.
    expect(drawn(1, 0)).toEqual(drawn(1, 240))
  })

  it('settles gradually rather than stopping dead', () => {
    const wobble = (plug: number) => {
      const a = drawn(plug, 0)
      const b = drawn(plug, 190)
      return Math.max(...a.map((p, i) => Math.hypot(p.x - b[i].x, p.y - b[i].y)))
    }
    expect(wobble(0)).toBeGreaterThan(wobble(0.5))
    expect(wobble(0.5)).toBeGreaterThan(wobble(1))
  })
})

describe('the collar closes a beat after the ion settles', () => {
  const at = (t: number) => pokeAt(POKE_MS * t)
  const firstAbove = (f: (t: number) => number) => {
    for (let t = 0; t <= 1; t += 0.001) if (f(t) > 0.001) return t
    return Infinity
  }
  const done = (f: (t: number) => number) => {
    for (let t = 0; t <= 1; t += 0.001) if (f(t) >= 0.999) return t
    return Infinity
  }

  it('waits until the ion has come to rest, and then some', () => {
    // ⚠ Drawn the instant the ion arrived, the collar was part of the
    // ARRIVING — one event, so landing and catching read as the same thing
    // (user, 2026-08-30: "make it appear after the ion settled… with a
    // pause"). Held back, they are two.
    const settled = done((t) => boundAt(at(t)))
    const collar = firstAbove((t) => ligandLockedAt(at(t)))
    expect(collar).toBeGreaterThan(settled)
    // A pause of the same order as every other pause in this run — measured in
    // milliseconds, because a fraction of a run whose length changes is not a
    // pause anybody can see.
    expect((collar - settled) * POKE_MS).toBeGreaterThanOrEqual(300)
  })

  it('closes as the door opens, which is what says the binding did it', () => {
    const collar = firstAbove((t) => ligandLockedAt(at(t)))
    const gate = firstAbove((t) => gateOpennessAt(at(t)))
    const gateDone = done((t) => gateOpennessAt(at(t)))
    expect(collar).toBeGreaterThanOrEqual(gate)
    expect(collar).toBeLessThanOrEqual(gateDone)
  })

  it('is gone by the end, so the next run starts clean', () => {
    expect(ligandLockedAt(at(0))).toBe(0)
    expect(ligandLockedAt(at(1))).toBeCloseTo(0, 3)
  })
})

describe('the messenger is a molecule, not a fifth ion', () => {
  // ⚠ It was drawn as a lone glossy ball in a spare orange, and read as the
  // chloride the channel passes (user, 2026-08-30: "we've earlier color-coded
  // Cl⁻ green… you display it brown in ligand-gated demo"). A single sphere IS
  // what this app means by "ion", whatever colour it wears — so the difference
  // had to be one of KIND.
  const midRun = () => {
    const c = strictCanvas()
    drawFamilyPanel(c.ctx, 'ligand', POKE_MS * 0.6, 1200)
    return c
  }

  it('draws it with bonds, which no ion in this app has', () => {
    const c = midRun()
    // Bonds are strokes along a path, and the messenger is the only thing on
    // this panel drawn as several bodies joined by lines.
    expect(c.calls.filter((k) => k === 'lineTo').length).toBeGreaterThanOrEqual(2)
    expect(c.calls).toContain('stroke')
  })

  it('carries no charge badge, because it has no charge worth drawing', () => {
    // Every ion in this app wears a ± badge. The messenger must not, or the
    // difference of kind collapses again.
    const withMessenger = midRun().calls.length
    const before = strictCanvas()
    drawFamilyPanel(before.ctx, 'ligand', null, 1200)
    expect(withMessenger).toBeGreaterThan(before.calls.length)
  })

  it('leaves the traffic through the channel CHLORIDE green', () => {
    // The thing that actually crosses is chloride, and it must keep the colour
    // the rest of the app gives chloride — the exhibit's whole point is that
    // the door is green because of what goes through it.
    expect(FAMILIES.find((f) => f.id === 'ligand')!.tint).toBe('cl')
    expect(GLOSSY_COLORS.cl.mid).toBe(GLOSSY_COLORS.cl.mid)
  })
})

describe('a push and its opening are one movement', () => {
  // ⚠ NO TEST GUARDED THIS, and the pause came straight back when it was
  // deliberately reintroduced (2026-08-30). The stretch-gated door shared the
  // pause built for the other two — right for them, because they wait on
  // something, and wrong here: the sheet bending IS what opens this door.
  const at = (t: number) => pokeAt(POKE_MS * t)
  const press = (t: number) => at(t).strength
  const doorOf = (id: FamilyId) => (t: number) => opennessAt(id, POKE_MS * t)

  const firstAbove = (f: (t: number) => number) => {
    for (let t = 0; t <= 1; t += 0.001) if (f(t) > 0.001) return t
    return Infinity
  }
  const done = (f: (t: number) => number) => {
    for (let t = 0; t <= 1; t += 0.001) if (f(t) >= 0.999) return t
    return Infinity
  }

  it('starts opening while the finger is still coming down', () => {
    const pressStarts = firstAbove(press)
    const pressDone = done(press)
    const opens = firstAbove(doorOf('mechanical'))
    expect(opens).toBeGreaterThan(pressStarts)
    // The overlap is the point: no moment where the wall is fully pressed and
    // the door has not begun to move.
    expect(opens).toBeLessThan(pressDone)
  })

  it('leaves the OTHER two their pause, which they need', () => {
    // The voltage-gated door waits on its sensor and the ligand-gated one on a
    // messenger finishing its landing. Collapsing those would make each chain
    // read as a single event.
    const pressDone = done(press)
    for (const id of ['voltage', 'ligand'] as const) {
      expect(firstAbove(doorOf(id))).toBeGreaterThan(pressDone)
    }
  })
})

describe('a plugged pore carries nothing', () => {
  it('stops the traffic the moment the ball seats', () => {
    // ⚠ Ions went on streaming past a ball sitting in the mouth (user,
    // 2026-08-30). Not a cosmetic slip: stopping the current is the entire
    // function of inactivation, and drawing it still flowing said the ball
    // does nothing.
    const flowing = POKE_MS * 0.6
    const plugged = POKE_MS * 0.8
    // Both are moments when the DOOR is open — so any difference is the ball.
    expect(opennessAt('voltage', flowing)).toBeGreaterThan(0.5)
    expect(opennessAt('voltage', plugged)).toBeGreaterThan(0.5)
    expect(ballInAt(pokeAt(flowing))).toBeLessThan(0.5)
    expect(ballInAt(pokeAt(plugged))).toBeGreaterThan(0.5)

    const a = strictCanvas()
    const b = strictCanvas()
    drawFamilyPanel(a.ctx, 'voltage', flowing, 1200)
    drawFamilyPanel(b.ctx, 'voltage', plugged, 1200)
    expect(b.points.length).toBeLessThan(a.points.length)
  })
})
