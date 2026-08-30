import { describe, expect, it } from 'vitest'
import { strictCanvas } from './strictCanvas'
import { leakHalfWidth } from './leakChannel'
import { HALF_MEM, PX_PER_NM } from './bilayer'
import { PANEL_W, PANEL_H, drawFamilyPanel, opennessAt, panelLabels } from './gatingScene'
import { spokenTermAt } from './spokenLabels'
import {
  FAMILIES,
  POKE_MS,
  ballInAt,
  boundAt,
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

  it('names each door on its own panel, inside it', () => {
    for (const f of FAMILIES) {
      const labels = panelLabels(f.id as FamilyId)
      expect(labels.length).toBeGreaterThan(0)
      for (const l of labels) {
        expect(spokenTermAt(labels, l.x + l.w / 2, l.y + l.h / 2)).toBeTruthy()
        expect(l.x).toBeGreaterThanOrEqual(0)
        expect(l.x + l.w).toBeLessThanOrEqual(PANEL_W)
        expect(l.y).toBeGreaterThanOrEqual(0)
        expect(l.y + l.h).toBeLessThanOrEqual(PANEL_H)
      }
    }
  })

  it('tints each door by the ION IT PASSES, not by its family', () => {
    // The app's own rule, and the reference figure's logic: colour means
    // species. The two sodium doors therefore SHARE a colour, and are told
    // apart by what opens them — which is the exhibit's point (2026-08-28).
    const byIon = Object.fromEntries(FAMILIES.map((f) => [f.id, f.tint]))
    expect(byIon.voltage).toBe(byIon.ligand)
    expect(byIon.leak).not.toBe(byIon.voltage)
    expect(byIon.mechanical).not.toBe(byIon.voltage)
    // Still enough colours that the row is not one wash.
    expect(new Set(FAMILIES.map((f) => f.tint)).size).toBeGreaterThan(2)
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
    expect(ball(0.4)).toBe(0)
    expect(open(0.4)).toBe(1)
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
    // In before the door opens, and gone only after it has shut.
    expect(bound(0.3)).toBeCloseTo(1, 2)
    expect(open(0.3)).toBeLessThan(0.3)
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
