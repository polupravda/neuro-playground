import { describe, expect, it } from 'vitest'
import { strictCanvas } from './strictCanvas'
import { ION_KINDS, IONS, particlesFor } from '../core/ions'
import type { IonCounts } from '../state/ionStore'
import { VM_MAX, VM_MIN } from '../core/voltage'
import { FIRE_STIMULUS } from '../core/spikeModel'
import { COMPARTMENT_UM } from '../core/cable'
import { fibreFront, fibreRun, sampleFibre } from '../core/fibre'
import { AXON_DIAMETER_UM } from '../core/membrane'
import {
  AXON_VIEW_SCALE,
  AXON_W,
  DRAWN_AXON_UM,
  STAGE_H,
  STAGE_W,
} from './layout'
import { DEFAULT_PATCH } from '../state/axonStore'
import {
  PATCHES,
  PATCH_UM,

  alongCable,
  lengthSquash,
  lensMagnification,
  lensNm,
  wallY,
  drawRibbon,
  millimetreTicks,
  patchAtX,
  patchCentre,
  patchHeat,
  patchSignal,
  patchSpanUm,
  plotY,
  ribbonGeometry,
  VIEW_LENGTH_UM,
  viewFibre,
  nearestNode,
  doorPlaces,
  DOOR_SPACING_UM,
  VIEW_INTERNODE_UM,
  sheathOuterY,
  SHEATH_THICK,
  spotRadius,
  spotTruePx,
  xAt,
  RACE_MS,
  raceTailStartU,
  raceLayout,
} from './axonRibbon'

const real: IonCounts = ION_KINDS.reduce((acc, kind) => {
  acc[kind] = {
    outside: particlesFor(IONS[kind].outsideMM),
    inside: particlesFor(IONS[kind].insideMM),
  }
  return acc
}, {} as IonCounts)

/** How thick this axon is drawn once the camera has arrived. */
const AXON_PX = AXON_W * AXON_VIEW_SCALE
const geo = ribbonGeometry(STAGE_W, STAGE_H, AXON_PX)

const view = (over: Partial<Parameters<typeof drawRibbon>[1]> = {}) => ({
  width: STAGE_W,
  height: STAGE_H,
  axonPx: AXON_PX,
  axonUm: AXON_DIAMETER_UM,
  run: fibreRun(real, true, FIRE_STIMULUS, viewFibre(false)),
  u: 0,
  counts: real,
  patch: DEFAULT_PATCH,
  drawnAxonUm: DRAWN_AXON_UM,
  fade: 1,
  ...over,
})

describe('the stripes', () => {
  it('tile the whole cable with no gaps and no overlaps', () => {
    // A gap would be axon that exists in the model and not in the picture, and
    // an overlap would be membrane drawn twice. Both are lies about a view whose
    // entire claim is that its x axis is a real length.
    expect(patchSpanUm(0)[0]).toBe(0)
    expect(patchSpanUm(PATCHES - 1)[1]).toBeCloseTo(VIEW_LENGTH_UM, 6)
    for (let i = 1; i < PATCHES; i++) {
      expect(patchSpanUm(i)[0]).toBeCloseTo(patchSpanUm(i - 1)[1], 6)
    }
  })

  it('is coarser than the model, never finer', () => {
    // The drawing SAMPLES the physics. If a stripe were smaller than a modelled
    // patch the picture would be claiming a resolution the cable does not have.
    expect(PATCH_UM).toBeGreaterThan(COMPARTMENT_UM)
  })
})

describe('the two axes', () => {
  it('puts the near end of the axon at the left and the far end at the right', () => {
    expect(xAt(geo, 0)).toBe(geo.left)
    expect(xAt(geo, 1)).toBe(geo.right)
    expect(xAt(geo, 0.5)).toBeCloseTo((geo.left + geo.right) / 2, 6)
  })

  it('clamps rather than drawing off the ends of the ruler', () => {
    expect(xAt(geo, -3)).toBe(geo.left)
    expect(xAt(geo, 4)).toBe(geo.right)
  })

  it('puts more positive voltages higher, and the two rails at the two edges', () => {
    expect(plotY(geo, VM_MAX)).toBeCloseTo(geo.plotTop, 6)
    expect(plotY(geo, VM_MIN)).toBeCloseTo(geo.plotBottom, 6)
    expect(plotY(geo, 0)).toBeLessThan(plotY(geo, -72))
  })

  it('marks every whole millimetre, and stops at the end of the axon', () => {
    const ticks = millimetreTicks()
    expect(ticks[0]).toBe(0)
    expect(ticks[ticks.length - 1]).toBe(VIEW_LENGTH_UM)
    for (const um of ticks) {
      expect(um % 1000).toBe(0)
      expect(xAt(geo, alongCable(um))).toBeGreaterThanOrEqual(geo.left)
      expect(xAt(geo, alongCable(um))).toBeLessThanOrEqual(geo.right)
    }
  })
})

describe('picking a stripe', () => {
  it('gives back the stripe you pointed at', () => {
    for (let i = 0; i < PATCHES; i++) {
      expect(patchAtX(geo, xAt(geo, patchCentre(i)))).toBe(i)
    }
  })

  it('clamps to the ends rather than returning a stripe that does not exist', () => {
    expect(patchAtX(geo, -400)).toBe(0)
    expect(patchAtX(geo, 99999)).toBe(PATCHES - 1)
  })

  it('opens on a stripe with a long wait ahead of it, not the one being zapped', () => {
    // The default stripe has to spend most of the run doing nothing, so that
    // being woken by its neighbour is an event rather than the first thing that
    // happens. A stripe at the electrode teaches the spike, not propagation.
    expect(DEFAULT_PATCH).toBeGreaterThan(PATCHES / 2)
    expect(DEFAULT_PATCH).toBeLessThan(PATCHES)
  })
})

describe('the magnifier, and the second scale', () => {
  it('shows a molecular length, in nanometres', () => {
    // Derived from the shared bilayer's own proportions — a membrane is 5 nm
    // thick and the drawing knows how many pixels that is — so the caption
    // cannot drift away from the picture.
    expect(lensNm(geo)).toBeGreaterThan(10)
    expect(lensNm(geo)).toBeLessThan(150)
  })

  it('shows a vanishing sliver of the stripe it sits on, never the whole one', () => {
    // "One spot on the membrane" must not read as "here is that stripe". A stripe
    // is 250 µm; this shows a ten-thousandth of it, and the two captions together
    // are what teach the gap.
    expect(lensNm(geo)).toBeLessThan((PATCH_UM * 1000) / 1000)
  })

  it('magnifies against the picture beside it, not against life', () => {
    const nmPerAxonPx = (VIEW_LENGTH_UM * 1000) / (geo.right - geo.left)
    const nmPerLensPx = lensNm(geo) / (geo.lensR * 2)
    expect(lensMagnification(geo)).toBeCloseTo(nmPerAxonPx / nmPerLensPx, 4)
    // Not "×1.5 million", which is magnification against real life and depends on
    // how big a pixel is on the screen it is read on. The ratio between two
    // drawings on the same screen is a fact about the drawing.
    expect(lensMagnification(geo)).toBeGreaterThan(10_000)
  })

  it('marks its spot with a ring that reads as a pair with the lens', () => {
    // Small circle, big circle, the second being the first enlarged — a shape
    // anyone can read without being told. Tied to the lens so the two scale
    // together rather than drifting apart on a different-sized stage.
    const r = spotRadius(geo)
    expect(r).toBeGreaterThan(15)
    expect(r).toBeLessThan(geo.lensR / 2)
    // And it stays out of the graph below: it is a mark on the axon, not on the
    // instruments around it.
    expect(r).toBeLessThanOrEqual(24 + geo.tubeHalf)
  })

  it('is honest in the describer about the ring being far too big', () => {
    // The spot the lens shows is a fraction of a pixel wide down on the axon —
    // unmarkable — so the ring is drawn big enough to see. That is a cheat, and
    // this is the number the describer quotes when owning up to it. If it ever
    // stopped being tiny the sentence would have to go.
    expect(spotTruePx(geo)).toBeGreaterThan(0)
    expect(spotTruePx(geo)).toBeLessThan(0.05)
    expect(spotRadius(geo) * 2).toBeGreaterThan(spotTruePx(geo) * 1000)
  })

  it('sits clear above the axon it is magnifying', () => {
    expect(geo.lensCy + geo.lensR).toBeLessThan(geo.tubeTop)
    expect(geo.lensR * 2).toBeLessThan(geo.right - geo.left)
  })
})

describe('the axon, drawn as a living thing', () => {
  it('draws its thickness at the camera’s honest scale', () => {
    // The one measurement in this view that is not squashed. If the tube were
    // fattened to look better, the squash factor it reports would be a lie.
    expect(geo.tubeHalf * 2).toBeCloseTo(AXON_PX, 6)
  })

  it('reports how much the length is squashed, off the drawing itself', () => {
    const squash = lengthSquash(geo, AXON_DIAMETER_UM)
    const umPerPxAlong = VIEW_LENGTH_UM / (geo.right - geo.left)
    const umPerPxAcross = AXON_DIAMETER_UM / AXON_PX
    expect(squash).toBeCloseTo(umPerPxAlong / umPerPxAcross, 4)
    expect(squash).toBeGreaterThan(50)
  })

  it('wobbles, but never past its own real width', () => {
    // A real axon meanders and beads, and this one does too — but the widest the
    // tube ever gets is its true width, so no part of the picture is fatter than
    // the biology.
    let widest = 0
    let narrowest = Infinity
    let wobbled = false
    for (let x = geo.left; x <= geo.right; x += 3) {
      const top = wallY(geo, x, -1)
      const bottom = wallY(geo, x, 1)
      widest = Math.max(widest, (bottom - top) / 2)
      narrowest = Math.min(narrowest, (bottom - top) / 2)
      if (Math.abs((top + bottom) / 2 - geo.tubeMid) > 0.5) wobbled = true
      expect(top).toBeGreaterThanOrEqual(geo.tubeTop - 0.001)
      expect(bottom).toBeLessThanOrEqual(geo.tubeBottom + 0.001)
    }
    expect(widest).toBeLessThanOrEqual(geo.tubeHalf + 0.001)
    expect(narrowest).toBeLessThan(geo.tubeHalf * 0.95)
    expect(wobbled).toBe(true)
  })

  it('wobbles the same way every time, because there is no clock in it', () => {
    // A shimmering tube would look alive in a way nothing about it is, and would
    // break the same-inputs-same-picture test the whole view rests on.
    for (let x = geo.left; x <= geo.right; x += 17) {
      expect(wallY(geo, x, -1)).toBe(wallY(geo, x, -1))
    }
  })
})

describe('the scale break, drawn rather than confessed', () => {
  it('puts the whole of the drawn axon inside the first stripe', () => {
    // The point of the amber tick. If it ever grew past one stripe, either this
    // view had shrunk or the stage's axon had grown, and the sentence about a
    // spike crossing the drawn axon in a tenth of a millisecond would need
    // rechecking.
    expect(DRAWN_AXON_UM).toBeLessThan(PATCH_UM)
    expect(alongCable(DRAWN_AXON_UM)).toBeLessThan(0.02)
  })
})

describe('the colour every view shares', () => {
  const traj = fibreRun(real, true, FIRE_STIMULUS, viewFibre(false))

  it('reads neutral everywhere on a resting axon', () => {
    // Grey means resting, and a resting axon is grey from end to end. If this
    // drifted, the little map of the cell would be quietly claiming something is
    // happening before anything has.
    for (let i = 0; i <= 10; i++) {
      expect(Math.abs(patchHeat(traj, 0, i / 10, real))).toBeLessThan(0.02)
    }
  })

  it('is hot under the wave and cold behind it, at one instant', () => {
    // The whole reason the map and the canvas can be said to be "in sync": they
    // ask this one function, so red and blue cannot come to mean different
    // things in the two pictures.
    // A quarter of the way through the run, with the front around halfway along —
    // late enough for a tail to exist, early enough for there to be axon ahead.
    const u = 0.25
    const front = fibreFront(traj, u)
    expect(front).not.toBeNull()
    const at = front as number
    expect(at).toBeGreaterThan(0.2)
    expect(at).toBeLessThan(0.8)
    expect(patchHeat(traj, u, at, real)).toBeGreaterThan(0.3)
    // Somewhere behind the front the axon is BELOW rest — the blue tail. Where
    // exactly depends on the speed and on how long a patch takes to recover, so
    // the test looks for it rather than asserting where it should be.
    let coldest = Infinity
    for (let i = 0; i <= 40; i++) coldest = Math.min(coldest, patchHeat(traj, u, (at * i) / 40, real))
    expect(coldest).toBeLessThan(0)
    // Well ahead of the front, nothing has happened yet.
    expect(Math.abs(patchHeat(traj, u, at + 0.2, real))).toBeLessThan(0.05)
  })
})

describe('the yellow flash', () => {
  const traj = fibreRun(real, true, FIRE_STIMULUS, viewFibre(false))

  it('shows nothing anywhere on a resting axon', () => {
    for (let i = 0; i <= 10; i++) expect(patchSignal(traj, 0, i / 10)).toBe(0)
  })

  it('is brightest where the membrane is at its peak, and dark either side', () => {
    // The whole safety of drawing a sweeping yellow glow: it is a brightness per
    // place, worked out from that place's own voltage, and not an object with a
    // position. Brightest at the crest, nothing at all where the voltage has not
    // crossed zero.
    const u = 0.25
    const front = fibreFront(traj, u) as number
    expect(patchSignal(traj, u, front)).toBeGreaterThan(0.2)
    expect(patchSignal(traj, u, front + 0.2)).toBe(0)
  })

  it('never claims more than the brightest the axon ever gets', () => {
    for (let i = 0; i <= 20; i++) {
      for (let j = 0; j <= 10; j++) {
        const lit = patchSignal(traj, i / 20, j / 10)
        expect(lit).toBeGreaterThanOrEqual(0)
        expect(lit).toBeLessThanOrEqual(1)
      }
    }
  })

  it('lights only where the charge ramp is at its reddest, not where it is blue', () => {
    // Two colours, two jobs: yellow says "the signal is here", red and blue say
    // "how far from rest". Anywhere the yellow is lit the ramp must be hot, or the
    // two are telling different stories about the same stripe.
    const u = 0.25
    for (let j = 0; j <= 40; j++) {
      const p = j / 40
      if (patchSignal(traj, u, p) > 0) expect(patchHeat(traj, u, p, real)).toBeGreaterThan(0)
    }
  })
})

describe('the sheath, when it is on', () => {
  const sheathed = fibreRun(real, true, FIRE_STIMULUS, viewFibre(true))
  const traj = fibreRun(real, true, FIRE_STIMULUS, viewFibre(false))

  it('shows the two fibres at the same length, or nothing can be compared', () => {
    // The thing that must not differ: the distance. Same length, same push, same
    // gradients — so the speeds underneath are a comparison and not a coincidence.
    expect(sheathed.lengthUm).toBeCloseTo(VIEW_LENGTH_UM, 6)
    expect(traj.lengthUm).toBeCloseTo(VIEW_LENGTH_UM, 6)
  })

  it('runs for a shorter WINDOW, because it finishes sooner', () => {
    // What is deliberately NOT held equal. Each run is trimmed to when its own
    // fibre stopped spiking, so the sheathed one is a shorter animation — and it
    // has to be, or seven eighths of it is a recovered axon sitting still and the
    // fibre that is meant to feel quick feels like the slow one.
    //
    // The RATE is what stays fixed (PLAY_MS buys VIEW_MS either way), so a run that
    // finishes in a third of the model time takes a third of the screen time. Hold
    // the screen duration equal instead and the quick fibre would look as slow as
    // the other one, which is the one thing this view must not do.
    const window = (r: typeof traj) => r.t[r.t.length - 1]
    expect(window(sheathed)).toBeLessThan(window(traj) * 0.75)
    // And neither is cut before its far end has fired and begun to fall back.
    for (const r of [traj, sheathed]) {
      const arrival = r.crossedAt[r.crossedAt.length - 1]
      expect(Number.isFinite(arrival)).toBe(true)
      expect(window(r)).toBeGreaterThan(arrival + 1)
    }
  })

  it('puts a countable row of nodes across the view, and none on a bare axon', () => {
    // Around a dozen, BY DESIGN and not by anatomy: the view's internodes are
    // stretched 3.6× so the stepping can be watched (see VIEW_INTERNODE_UM). The
    // honest 43 fired 45 µs apart — a strobe no eye could parse.
    const nodes = sheathed.parts.filter((part) => part.excitable).length
    expect(nodes).toBeGreaterThan(6)
    expect(nodes).toBeLessThan(20)
    // A bare axon has no nodes to find, so the glass has nothing to snap to.
    expect(traj.parts.every((part) => part.excitable)).toBe(true)
  })

  it('snaps the magnifier to a node, because it would never land on one', () => {
    // A node is 1 µm of a 141 µm repeat. Left free, the glass would show sheathed
    // membrane essentially every time and a child could never look at the place
    // where anything happens.
    for (let i = 0; i < PATCHES; i++) {
      const at = nearestNode(sheathed, patchCentre(i))
      const onNode = sheathed.parts.some(
        (part) => part.excitable && Math.abs(part.x / VIEW_LENGTH_UM - at) < 1e-9,
      )
      expect(onNode).toBe(true)
      // And it snaps to a NEAR one rather than wandering off down the axon:
      // within one internode. (Not half of one — the fibre ends mid-internode,
      // so a stripe by the far edge can sit most of a full internode from the
      // last node that exists.)
      expect(Math.abs(at - patchCentre(i))).toBeLessThan(0.085)
    }
  })

  it('has sodium doors open at the nodes and nowhere else, ever', () => {
    // What the flashes are drawn from. Under a sleeve there are no voltage-gated
    // channels to open, so the light cannot come on there — which is why the
    // flashes mark nodes rather than being placed at them.
    const sheathPositions = sheathed.parts
      .filter((part) => !part.excitable)
      .map((part) => part.x / VIEW_LENGTH_UM)
    for (let i = 0; i <= 20; i++) {
      for (const at of sheathPositions) {
        // Not exactly zero, and the reason is arithmetic rather than physics: a
        // position is asked for as a fraction, so the round trip through
        // x / length * length lands a hair off the compartment's own centre and
        // interpolation blends in a millionth of a millionth of a millionth of
        // its neighbour. The drawing's threshold is 0.02.
        expect(sampleFibre(sheathed, 'naOpen', i / 20, at)).toBeLessThan(1e-9)
      }
    }
  })

  it('opens those doors in order, one node after the next', () => {
    // The flashes have to be a sequence, or there is no demonstration. Their
    // PLACES are given by the anatomy; their ORDER and their timing are the
    // physics, and that is the part worth asserting.
    const nodes = sheathed.parts
      .map((part, i) => ({ part, at: sheathed.crossedAt[i] }))
      .filter(({ part }) => part.excitable && Number.isFinite(sheathed.crossedAt[0]))
    const fired = nodes.filter(({ at }) => Number.isFinite(at))
    expect(fired.length).toBeGreaterThan(6)
    for (let i = 1; i < fired.length; i++) {
      expect(fired[i].at).toBeGreaterThanOrEqual(fired[i - 1].at)
    }
    // And they are genuinely separated in time, not one simultaneous flash.
    expect(fired[fired.length - 1].at - fired[0].at).toBeGreaterThan(0.5)
  })

  it('lights the bare axon between the stripes too, so the contrast is real', () => {
    // The other half of the comparison: on bare axon every patch regenerates, so
    // there is no dark stretch anywhere. If this ever came out the same as the
    // sheathed fibre the demonstration would be showing nothing.
    let litSomewhereBetween = false
    for (let i = 0; i <= 20; i++) {
      for (let j = 1; j < PATCHES; j += 2) {
        if (sampleFibre(traj, 'naOpen', i / 20, patchCentre(j)) > 0.02) {
          litSomewhereBetween = true
        }
      }
    }
    expect(litSomewhereBetween).toBe(true)
  })

  it('wraps the sheath OUTSIDE the axon, never in the cytoplasm', () => {
    // Myelin is another cell wrapped round the axon: it belongs between the
    // axon's own membrane and the outside world. The first version of this
    // drawing had a sign the wrong way round and put it inside — invisible in the
    // arithmetic, obvious the moment a person looked at the picture. Hence a test
    // for something nobody would otherwise think to check.
    const SLEEVE = 21
    for (let x = geo.left + 20; x < geo.right - 20; x += 37) {
      for (const side of [-1, 1] as const) {
        for (const fromEnd of [0, 2, 10, SLEEVE / 2]) {
          const wall = wallY(geo, x, side)
          const outer = sheathOuterY(geo, x, side, fromEnd, SLEEVE)
          // Further from the middle of the axon than the wall is — always, even
          // at the very end of a sleeve, where a rounded corner still leaves it
          // standing off the membrane.
          expect(Math.abs(outer - geo.tubeMid)).toBeGreaterThan(
            Math.abs(wall - geo.tubeMid),
          )
        }
      }
    }
  })

  it('keeps the sheath inside the band drawn for the world outside', () => {
    // It is fat wrapped round the axon, not a second axon: it has to fit in the
    // space outside without spilling into the graph or the ruler.
    expect(SHEATH_THICK(geo)).toBeLessThan(24)
    for (let x = geo.left + 20; x < geo.right - 20; x += 53) {
      expect(sheathOuterY(geo, x, -1, 10, 21)).toBeGreaterThan(geo.tubeTop - 24)
      expect(sheathOuterY(geo, x, 1, 10, 21)).toBeLessThan(geo.tubeBottom + 24)
    }
  })

  it('draws each sleeve as a rounded rectangle, not a spindle or a wedge', () => {
    // Two wrong shapes came before this one. A sine curve to a power tapers the
    // whole way along, so every sleeve was a spindle and the row was a line of
    // spikes. A linear plateau is flat in the middle but chamfered at the ends,
    // which is a trapezium and looks like one. What a wrapped sleeve actually
    // presents is uniform wraps along its length with the ends squared off and the
    // corners turned.
    const x = (geo.left + geo.right) / 2
    const SLEEVE = 21
    const at = (fromEnd: number) =>
      Math.abs(sheathOuterY(geo, x, -1, fromEnd, SLEEVE) - wallY(geo, x, -1))
    const full = at(SLEEVE / 2)

    // Flat: the same height anywhere past the corner.
    expect(at(6)).toBeCloseTo(full, 6)
    expect(at(9)).toBeCloseTo(full, 6)

    // A corner, not a point: at the very end it is LOWER than full but still
    // standing well off the membrane. A spindle or a wedge would be at zero here.
    expect(at(0)).toBeLessThan(full)
    expect(at(0)).toBeGreaterThan(full * 0.4)

    // And the corner is round rather than straight: halfway through it, a chamfer
    // would be exactly halfway up, and an arc is higher than that.
    const corner = 5
    const chamfer = at(0) + (full - at(0)) * 0.5
    expect(at(corner / 2)).toBeGreaterThan(chamfer)
  })

  it('keeps the sheath low enough that the axon is still the subject', () => {
    expect(SHEATH_THICK(geo)).toBeLessThan(geo.tubeHalf * 0.35)
  })

  it('marks doors far more often on the bare axon than on the sheathed one', () => {
    // The distance from one set of doors to the next IS the feature. A bare axon
    // rebuilds the signal at every patch, so channels run its whole length; a
    // sheathed one rebuilds only at nodes, half a millimetre apart, with nothing
    // between. Draw them at the same spacing in both — which an earlier pass did,
    // reasoning about density per unit membrane and forgetting what the spacing
    // was for — and there is no reason left for myelin to exist.
    const nodes = sheathed.parts.filter((part) => part.excitable).length
    const bareMarks = Math.ceil(VIEW_LENGTH_UM / DOOR_SPACING_UM)
    expect(bareMarks).toBeGreaterThan(nodes * 1.5)
    expect(DOOR_SPACING_UM).toBeLessThan(VIEW_INTERNODE_UM / 1.5)
  })

  it('scatters the bare axon\'s channels and lines the sheathed one\'s up', () => {
    // Real contrast, not decoration. Sodium channels in bare membrane sit
    // essentially at random; a node's are held in an ordered array by a protein
    // scaffold. So the honest difference is not only many against few — it is a
    // random scatter against an organised cluster.
    const gaps = (places: number[]) =>
      places.slice(1).map((p, i) => p - places[i])
    const spread = (xs: number[]) => Math.max(...xs) / Math.min(...xs)
    expect(spread(gaps(doorPlaces(traj)))).toBeGreaterThan(1.5)
    expect(spread(gaps(doorPlaces(sheathed)))).toBeLessThan(1.05)
  })

  it('rebuilds the signal at far fewer places when it is wrapped', () => {
    // The whole reason myelin is worth having, and the thing the sparks show:
    // same distance, fewer rebuilds. Both fibres spark wherever they rebuild, so
    // this is also the count of sparks you can watch.
    expect(doorPlaces(traj).length).toBeGreaterThan(doorPlaces(sheathed).length * 1.5)
  })

  it('is measurably quicker than the bare axon it is drawn beside', () => {
    expect(sheathed.speedMs).toBeGreaterThan(traj.speedMs * 3)
  })
})

describe('the layout', () => {
  it('stacks the lens, the axon, the graph and the ruler without them colliding', () => {
    expect(geo.lensCy + geo.lensR).toBeLessThan(geo.tubeTop)
    expect(geo.tubeTop).toBeLessThan(geo.tubeBottom)
    expect(geo.tubeBottom).toBeLessThan(geo.plotTop)
    expect(geo.plotTop).toBeLessThan(geo.plotBottom)
    expect(geo.plotBottom).toBeLessThan(geo.rulerY)
    expect(geo.rulerY + 16).toBeLessThanOrEqual(STAGE_H)
  })

  it('sits on the floor of the canvas rather than floating above it', () => {
    // The ruler's labels are the lowest thing drawn, and they belong just inside
    // the bottom edge: a band of empty canvas under the picture is height the
    // magnifier could have had.
    const lowest = geo.rulerY + 15
    expect(lowest).toBeLessThanOrEqual(STAGE_H)
    expect(STAGE_H - lowest).toBeLessThan(24)
  })

  it('gives the magnifier the room that is left, which is most of it', () => {
    // The lens is the big thing on screen, and deliberately: it is the only
    // place the molecules can honestly be drawn.
    expect(geo.lensR * 2).toBeGreaterThan(geo.tubeHalf * 2)
    expect(geo.lensCy - geo.lensR).toBeGreaterThan(60)
  })

  it('survives a small stage instead of inverting itself', () => {
    const small = ribbonGeometry(360, 420, AXON_PX)
    expect(small.right).toBeGreaterThan(small.left)
    expect(small.plotBottom).toBeGreaterThan(small.plotTop)
    expect(small.lensR).toBeGreaterThan(0)
  })
})

/** ⚠ THIS FILE USED TO CARRY ITS OWN PERMISSIVE CANVAS STAND-IN, and it
 *  cost exactly what the rule says a second stand-in costs (2026-08-28): it
 *  had no `bezierCurveTo`, so the moment the channel silhouette was redrawn
 *  with beziers these tests threw on a context a browser is perfectly happy
 *  with — while `strictCanvas`, three files away, had supported it all along.
 *  A stand-in must fail where the real thing fails, and there must be ONE of
 *  them. */
const recorder = strictCanvasRecorder

function strictCanvasRecorder(): CanvasRenderingContext2D & { calls: string[] } {
  const c = strictCanvas()
  return Object.assign(c.ctx, { calls: c.calls }) as CanvasRenderingContext2D & {
    calls: string[]
  }
}

describe('drawing a frame', () => {
  const traj = fibreRun(real, true, FIRE_STIMULUS, viewFibre(false))

  it('draws the resting axon without complaint', () => {
    const ctx = recorder()
    expect(() => drawRibbon(ctx, view({ run: traj }))).not.toThrow()
    expect(ctx.calls.length).toBeGreaterThan(100)
  })

  it('draws every moment of the run, on every stripe, including the very end', () => {
    for (let i = 0; i <= 20; i++) {
      const ctx = recorder()
      expect(() => drawRibbon(ctx, view({ run: traj, u: i / 20, patch: i % PATCHES }))).not.toThrow()
    }
  })

  it('draws part-way through the camera flight, at whatever width it is at', () => {
    // The tube grows with the flight rather than appearing at its final size, so
    // it has to be drawable at every thickness on the way in.
    for (const scale of [1, 3, 7, AXON_VIEW_SCALE]) {
      const ctx = recorder()
      expect(() =>
        drawRibbon(ctx, view({ run: traj, axonPx: AXON_W * scale, fade: 0.4 })),
      ).not.toThrow()
    }
  })

  it('does not care what order the stripes were drawn in', () => {
    // The claim this whole view rests on: there is no travelling object whose
    // position depends on the drawing. Two frames at the same moment must be
    // identical calls for identical inputs — no clock, no accumulated state, no
    // randomness anywhere in the picture.
    const a = recorder()
    const b = recorder()
    const frame = view({ run: traj, u: 0.42 })
    drawRibbon(a, frame)
    drawRibbon(b, frame)
    expect(a.calls).toEqual(b.calls)
  })
})

describe('the race', () => {
  const runs = [false, true].map(m => fibreRun(real, true, FIRE_STIMULUS, viewFibre(m, true)))

  it('runs long enough for the BARE fibre to come back down, not merely to arrive', () => {
    // The bug this pins: the race window used to end at 14 ms. The bare fibre is
    // home at 9.7, so the animation stopped on a far end still 15 mV under its
    // resting voltage — an axon frozen blue. Arriving is not finishing.
    for (const run of runs) {
      const rest = sampleFibre(run, 'vm', 0, 0.9)
      let worst = 0
      for (let i = 0; i <= 20; i++) {
        worst = Math.min(worst, sampleFibre(run, 'vm', 1, i / 20) - rest)
      }
      expect(Math.abs(worst)).toBeLessThan(4)
    }
  })

  it('does not hurry until the SECOND fibre is home', () => {
    const tailMs = raceTailStartU(runs) * RACE_MS
    const arrivals = runs.map(r => r.crossedAt[r.crossedAt.length - 1])
    expect(tailMs).toBeGreaterThan(Math.max(...arrivals))
    // and it does hurry — otherwise the longer window is dead time on screen
    expect(tailMs).toBeLessThan(RACE_MS * 0.75)
  })

  it('puts its ruler exactly where the single-fibre views put theirs', () => {
    // Switching modes must not move the one fixed thing on the page. The race
    // used to centre its block, so its ruler floated mid-canvas while bare and
    // myelinated both rested theirs on the floor.
    for (const height of [620, 660, 760, 900]) {
      const g = ribbonGeometry(STAGE_W, height, AXON_PX)
      const plan = raceLayout(g, g.tubeHalf)
      expect(plan.rulerY).toBe(g.rulerY)
      // two lanes, in order, both above the ruler and below the clock
      expect(plan.clockY).toBeLessThan(plan.lane1)
      expect(plan.lane1).toBeLessThan(plan.lane2)
      expect(plan.lane2 + g.tubeHalf).toBeLessThan(plan.rulerY)
    }
  })
})
