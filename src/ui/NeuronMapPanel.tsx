import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ASTRO_INK,
  AXON_POLYLINE,
  AXON_SIGNAL_T,
  BOUTON_R,
  DENDRITE_SEGS,
  DENDRITE_TRUNKS,
  HILLOCK,
  SOMA,
  OUTPUT,
  SOMA_OUTLINE,
  SOMA_R,
  litTrunks,
  TERMINAL_BRANCHES,
  TERMINALS,
  clamp01,
  partialPath,
  polylinePoint,
  terminalArrival,
  terminalReach,
  type Pt,
} from '../stage/layout'
import { fibreRun } from '../core/fibre'
import { screenDurationMs, viewFibre } from '../stage/axonRibbon'
import { ARBOR_MS, AXON_AP_MS } from '../stage/chain'
import {
  AXON_MEMBRANE_T,
  MAP_ASTROCYTES,
  NEURON_MAP_BOX,
  ZOOM_TARGETS,
  astroShape,
  astroNucleus,
  mapShowsAstrocytes,
  regionOfZoom,
} from '../stage/layout'
import { STIMULI } from '../core/scenarios'

/** Points → an SVG path `d`, optionally closed — the miniature's one spelling
 *  of a traced polyline (the soma, the arbor, the astrocytes). */
const dOf = (pts: Pt[], close = false) =>
  pts.map((p, k) => `${k ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ') +
  (close ? ' Z' : '')
import { sampleAt, trajectory } from '../core/spikeModel'
import { useApStore } from '../state/apStore'
import { SIGNAL_CORE, SIGNAL_RGB } from '../stage/signal'
import { useAxonStore } from '../state/axonStore'
import { useIonStore } from '../state/ionStore'
import { useMembraneStore } from '../state/membraneStore'
import { useNeuronStore } from '../state/neuronStore'

// "Where is this happening?" — the whole cell, small, in the same language the
// whole-neuron canvas uses. On screen for EVERY view, at the top of the column.
//
// It began as the axon view's own thumbnail and was shown nowhere else, which
// left the app's most disorienting moments unanswered: a membrane patch fills the
// screen with a wall of fat and two ions, and nothing on the page said which
// millimetre of which cell that wall was cut from. A child who has zoomed in ×140
// has lost the thread the app spent its first milestone establishing.
//
// So it is permanent now, and it answers two questions at once:
//
//   • WHERE — the dashed ring sits on the zoom target's OWN centre, the same
//     point the camera flies to, so the map cannot drift out of agreement with
//     what the canvas is showing. Nothing to keep in sync: one number, read twice.
//   • WHETHER A SPIKE IS RUNNING — and if so, where on the cell. Each view has a
//     different thing doing the firing (the chain across the whole neuron, one
//     patch's own spike, the propagating wave out on the axon), so each lights the
//     map from the run it actually has. What they share is the yellow, which
//     everywhere in this app means one thing: a signal is here.
//
// It is built from the SAME geometry the main canvas draws with, so it cannot
// slowly stop being a picture of that neuron, and it lights up with the SAME
// yellow, which everywhere in this app means one thing: a signal is here. It does
// not use the red/blue charge ramp, which answers a different question ("how far
// from rest is this membrane") and belongs on the canvas next to it, where there
// is room to read it.
//
// ------------------------------------------------------------- the whole story
//
// The run opens with a lead-in, because a spike with no cause is half a lesson.
// An input fires, its ripple spreads inward along a dendrite and fades as it goes,
// the soma adds up what arrives — and when that reaches the axon, THAT is what
// starts the run on the canvas. Pressing a button is not the cause; something
// arriving is.
//
// -------------------------------------------------- what this axon stands for
//
// Propagation is drawn here, gradually, and getting to that took an argument worth
// recording — because for one version this panel lit its whole axon at once.
//
// The reasoning behind that was: the cell as drawn has a 93 µm axon, a spike
// crosses the whole of it in about 0.15 ms, and drawing that as a journey
// overstates a delay. True as far as it goes. But it walks into something worse.
// A picture of an axon lighting all at once teaches that an axon fires as a UNIT —
// which is precisely the misconception this milestone exists to dismantle, and no
// caption undoes a picture. Accuracy to seven per cent bought at the price of the
// central idea is a bad trade.
//
// And the delay is REAL. It is 0.15 ms, not zero. Drawing it slowly is
// time-stretching, which is what this app does everywhere — the spike itself is
// stretched about two hundred times, the whole-neuron chain rather more — and not
// an invention.
//
// So the axon here is a MAP OF THE MODELLED STRETCH: the same six millimetres the
// canvas shows, drawn along the cell's own outline instead of along a ruler, with
// the dashed ring marking where the canvas is looking. Its light comes from
// `patchSignal`, the same function that lights the stripes on the canvas, read at
// the matching place — so the two are one picture at two zooms rather than two
// animations that happen to agree. The compression is the same kind the canvas
// already declares on its ruler (length squashed ~390×), just more of it, and the
// describer says so.
//
// The dendrites are the other half of the contrast and are drawn from the same
// idea: a graded potential really does spread inward over milliseconds and really
// does fade as it goes, which is what the axon exists to break.

/** The lead-in's beats: the ripple travelling in, the soma filling up, the hillock
 *  letting go, and the signal starting off down the axon towards the ring.
 *
 *  The proportions carry a fact, restated small: a dendrite's graded signal
 *  spreads PASSIVELY — slow as well as fading — while the axon's spike is rebuilt
 *  as it goes, fast and full-size. So the ripple gets over half the lead-in to
 *  crawl a few dendrite-lengths (~110 px/s on screen), and the spike takes the
 *  last fifth to cover ten times the distance (~640 px/s — six times the pace,
 *  visibly a sprint against a crawl). The paces meet at the ring: the pre-ring
 *  stretch runs 0.3 of the axon in 0.48 s, the same fractions-per-second as
 *  MAP_SWEEP_MS gives the rest, so the sprint is one continuous motion and the
 *  only slow thing on this cell is the dendrite. */
const RIPPLE_UNTIL = 0.55
const SOMA_FROM = 0.3
const HILLOCK_FROM = 0.72
const AXON_FROM = 0.8

/** How far behind the front the light is still lit, as a fraction of the axon. */
const LEAD_WAKE = 0.16

/** How long the map's own axon takes from the ring to the terminals, ms of screen
 *  time — its OWN clock, deliberately faster than the canvas beside it.
 *
 *  The two used to share the model's pace, and at the canvas's slow-motion the
 *  little axon crawled for nine seconds — a thumbnail replaying the main picture,
 *  slower than a thumbnail should do anything. They are now coupled at exactly ONE
 *  point: the canvas run starts the instant the map's signal reaches the ring, and
 *  from there each tells the story at the pace its own size wants. The map is
 *  choreography, as the whole-neuron chain is; the canvas is the measurement. */
const MAP_SWEEP_MS = 1100

/** The arbor's share of the sweep — the SAME fraction of the axon leg the
 *  chain model gives it (ARBOR_MS / AXON_AP_MS, itself measured from the
 *  traced route lengths), so the little wave keeps one pace through the
 *  forks, exactly as the big one does. */
const MAP_ARBOR_MS = Math.round(MAP_SWEEP_MS * (ARBOR_MS / AXON_AP_MS))
/** How long the fully-invaded arbor (and the cable behind it) takes to
 *  settle back out. */
const MAP_SETTLE_MS = 900

/** How many pieces the little axon is drawn in. */
const SEGMENTS = 26

/** How many sleeves the little axon is drawn in when the sheath is on — the same
 *  twelve the canvas has, so the two pictures are countably the same fibre.
 *
 *  Schematic, and it has to be: this axon is about 126 px long on screen, so a
 *  sleeve is ten of them. What it can carry is the SHAPE of the thing — a beaded
 *  line rather than a smooth one, pale segments with dark gaps between — which is
 *  enough for "that is the wrapped one" to be read at a glance and matched to what
 *  the canvas is showing. */
const MAP_SLEEVES = 12

/** Half the gap between two sleeves, in fractions of the axon. */
const MAP_GAP = 0.09 / MAP_SLEEVES

/** Where the nodes sit on the little axon, 0→1 — the start of each repeat. */
const mapNodes = Array.from({ length: MAP_SLEEVES }, (_, i) => i / MAP_SLEEVES)

/** A sleeve's own stretch of the axon, as a list of points to draw through.
 *
 *  One plain bead, and it stays that way. Stepped ends were tried here — three
 *  tiers, widest shortest, the staircase every textbook draws — and reverted: at
 *  ten pixels a sleeve the steps are a pixel and a half each, which does not read
 *  as a staircase, only as noise. The stepped detail belongs where there is room
 *  for it, and there is: the magnifying glass on the canvas draws the lamellae
 *  ending one by one at the paranode. */
function sleevePoints(i: number): string {
  const from = i / MAP_SLEEVES + MAP_GAP
  const to = (i + 1) / MAP_SLEEVES - MAP_GAP
  return Array.from({ length: 5 }, (_, k) => {
    const at = polylinePoint(AXON_POLYLINE, from + ((to - from) * k) / 4)
    return `${at.x},${at.y}`
  }).join(' ')
}

/** How finely the chain's sweep is stepped. Enough to look continuous, few enough
 *  that a thumbnail is not re-rendered sixty times a second. */
const MAP_STEPS = 45

/** How long the miniature takes to carry the signal up to the ring, and away from
 *  it again, ms.
 *
 *  Fast, and much faster than the demo it accompanies. The map used to follow the
 *  membrane demo's own position, and that demo deliberately STOPS at each gate
 *  moment so a child can read what just opened — so the little axon crawled and
 *  halted, half a dozen times, on its way past. That is a true picture of the
 *  demo's pacing and a false picture of the neuron: a spike crosses this axon in a
 *  seventh of a millisecond and stops nowhere.
 *
 *  So the map runs at its own speed and pauses in exactly one place: the ring. Which
 *  is honest about a different thing — the pause is not the signal waiting, it is
 *  US waiting, at the spot we have chosen to look at. */
const MAP_ARRIVE_MS = 620

const QUIET = 'rgba(148, 163, 184, 0.42)'
/** The "you are here" mark. Amber, like the signal — see the note at the call
 *  site for why that is safe here and was not when it was a stroke along the axon:
 *  a thin dashed RING is never read as a glow. */
const MARK = 'rgba(251, 191, 36, 0.95)'
/** The sheath, as much of it as this size can say. */
const SHEATH_TOP = 'rgba(233, 226, 208, 0.95)'

export function NeuronMapPanel() {
  // The whole-cell chain's own progress through its axon, ms.
  //
  // A clock of its own, and reluctantly: the chain's positions live in a ref on
  // the stage and only its PHASE reaches the store, so there is nothing to read.
  // The alternative was for the map to light the axon uniformly during that phase,
  // which is the one picture this milestone exists to argue against.
  //
  // Bucketed to keep it cheap — this re-renders a thumbnail, not the canvas — and
  // it stops as soon as the sweep is done rather than running with the phase.
  const [chainStep, setChainStep] = useState<number | null>(null)
  const sweptRunRef = useRef<number | null>(null)
  const chainFrameRef = useRef(0)

  // At a membrane patch the map has its own two-legged sweep: up to the ring, hold
  // there for as long as the demo is running, then on to the endings.
  const [patchStep, setPatchStep] = useState(0)
  const patchFrameRef = useRef(0)
  const zoom = useNeuronStore((s) => s.zoom)
  const phase = useNeuronStore((s) => s.phase)
  const runId = useNeuronStore((s) => s.run?.id ?? null)
  // WHICH inputs fired, not just that something did (2026-08-28).
  //
  // The ripple and the dendrite glow both ran over every synapse-bearing
  // trunk, so firing ONE input lit all three dendrites. That is the same
  // misconception the axon rule exists to kill, one structure earlier: it
  // says every input arrives whenever any input arrives, and it quietly
  // contradicts the control the child just used — they chose one, and three
  // answered. Only the branches that were actually fired light now.
  const firedInputs = useNeuronStore((s) => s.run?.inputs ?? null)
  const counts = useIonStore((s) => s.counts)
  const leaksOn = useMembraneStore((s) => s.leaksOn)
  const stimulus = useAxonStore((s) => s.stimulus)
  const myelin = useAxonStore((s) => s.mode) === 'myelin'
  // Bucketed rather than raw. Both positions advance every frame, and a thumbnail
  // re-rendered sixty times a second to move a glow by a hair is work for nothing
  // — 150 steps is smoother than the eye needs, and Zustand drops the rest.
  const step = useAxonStore((s) => (s.u === null ? null : Math.round(s.u * 150)))
  const leadStep = useAxonStore((s) =>
    s.lead === null ? null : Math.round(s.lead * 150),
  )
  // The patch's own spike, bucketed for the same reason.
  const apStep = useApStore((s) => (s.u === null ? null : Math.round(s.u * 120)))

  const traj = useMemo(
    () => fibreRun(counts, leaksOn, STIMULI[stimulus].amplitude, viewFibre(myelin)),
    [counts, leaksOn, stimulus, myelin],
  )

  // One spike on one patch, for the membrane views. The same memoised run the
  // canvas beside it is drawing from, so the thumbnail lights when the big
  // picture lights.
  const apTraj = useMemo(
    () => trajectory(counts, leaksOn, STIMULI.spike.amplitude),
    [counts, leaksOn],
  )

  // Shared with the bench's inset — see NEURON_MAP_BOX in layout.ts for why it
  // is computed there rather than here.
  const bounds = NEURON_MAP_BOX

  // Which PART of the cell the camera is in, and whether it is a patch of axon
  // rather than the stretch view — they animate the map differently.
  const onAxon = zoom === 'axon-signal'
  const onAxonPatch = regionOfZoom(zoom) === 'axon' && !onAxon

  // The chain's sweep runs ONCE PER RUN.
  //
  // It used to be keyed on the phase, and the phase changes three times while the
  // signal is on its way out — axon, terminal, target. Each change tore the effect
  // down and built it again with a fresh start time, so the little axon fired three
  // times for one action potential. A clock must belong to the EVENT it is timing,
  // not to whatever happens to be re-rendering.
  //
  // So: armed when the axon phase begins, remembered by run id so it cannot be
  // armed twice, and left alone until it finishes. The frame handle lives in a ref
  // because the sweep has to survive the phase changes that used to kill it.
  useEffect(() => {
    if (zoom !== null || runId === null) {
      sweptRunRef.current = null
      setChainStep(null)
      return
    }
    if (phase !== 'axon' || sweptRunRef.current === runId) return
    sweptRunRef.current = runId
    const started = performance.now()
    // The clock runs PAST the axon's end: the overshoot is the wave's time in
    // the terminal arbor, then its settle — the arbor is invaded, not
    // switched on (corrections 2026-09-04), so the sweep cannot stop at the
    // last branch point.
    const lastStep = Math.ceil(
      ((MAP_SWEEP_MS + MAP_ARBOR_MS + MAP_SETTLE_MS) / MAP_SWEEP_MS) * MAP_STEPS,
    )
    const tick = (ms: number) => {
      const step = Math.round(((ms - started) / MAP_SWEEP_MS) * MAP_STEPS)
      setChainStep(Math.min(lastStep, step))
      if (step < lastStep) chainFrameRef.current = requestAnimationFrame(tick)
    }
    chainFrameRef.current = requestAnimationFrame(tick)
  }, [zoom, phase, runId])

  // The patch legs. `apStep === null` means nothing is running, so both legs reset;
  // a finished spike (apStep at its top) releases the second leg.
  useEffect(() => {
    if (!onAxonPatch || apStep === null) {
      setPatchStep(0)
      return
    }
    const leaving = apStep >= 120
    const from = performance.now()
    const base = leaving ? 1 : 0
    const tick = (ms: number) => {
      const t = Math.min(1, (ms - from) / MAP_ARRIVE_MS)
      setPatchStep(base + t)
      if (t < 1) patchFrameRef.current = requestAnimationFrame(tick)
    }
    patchFrameRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(patchFrameRef.current)
    // Deliberately NOT keyed on apStep: the demo's position changes constantly and
    // restarting this clock on every one of them is what made the sweep stutter.
    // Only two things matter — that something is running, and whether it has
    // finished.
  }, [onAxonPatch, apStep === null, apStep !== null && apStep >= 120])

  // Cancelled only when the view changes or the panel goes — never by a phase.
  useEffect(
    () => () => {
      if (chainFrameRef.current) cancelAnimationFrame(chainFrameRef.current)
    },
    [],
  )

  const target = ZOOM_TARGETS.find((t) => t.id === zoom) ?? null

  // Gated on the axon view rather than branched: with these null, every value
  // derived from them below falls to nothing on its own, so the propagation
  // animation simply is not running elsewhere — no second code path to keep true.
  const lead = !onAxon || leadStep === null ? null : leadStep / 150
  const u = !onAxon || step === null ? null : step / 150

  // How far the lead-in has carried the signal down the axon, towards the ring.
  const leadFront =
    lead === null || lead <= AXON_FROM
      ? null
      : AXON_SIGNAL_T * clamp01((lead - AXON_FROM) / (1 - AXON_FROM))

  /** How lit a point along the little axon is, 0→1.
   *
   *  Before the ring it is the lead-in's business; from the ring on it is the
   *  model's, read through the same function the canvas lights its stripes with.
   *  The two overlap for a moment at the hand-over so neither blinks. */
  // The map's own front, past the ring: `u` is the canvas's position through its
  // slowed-down run, so it is converted to real screen milliseconds and the map
  // sweeps at its own pace from there. One clock still drives everything — this
  // reshapes it, it does not add another.
  const apU = apStep === null ? null : apStep / 120
  const apVm = apU === null ? null : sampleAt(apTraj, 'vm', apU)
  const apLit =
    apVm === null || apVm <= 0 ? 0 : Math.min(1, apVm / Math.max(1, apTraj.peak))

  // ------------------------------------------------- ONE sweep, whatever is on
  //
  // The axon on this map fires patch by patch in EVERY view, from whichever clock
  // happens to be running. It did not: out on the axon it swept, at a membrane
  // patch it glowed all over at once, and during the whole-cell chain it did a
  // third thing. Three pictures of one event, which is the exact opposite of what
  // a map beside a guided trace is for — and one of the three was the misconception
  // this milestone exists to dismantle, since an axon lighting as a unit is what
  // saltatory conduction is NOT.
  //
  // Honest at a membrane patch? Yes, and it is more honest than the glow it
  // replaces. The tour measures the claim: one patch on its own and one patch in
  // the middle of this axon give the same spike to within half a millivolt. A patch
  // of a real axon that fires propagates, and the map is a picture of the whole
  // cell, not of the isolated patch on the canvas.
  const chainSweep = chainStep === null ? null : (chainStep / MAP_STEPS) * MAP_SWEEP_MS

  // Where the ring sits along the axon is AXON_MEMBRANE_T — the patch the camera is
  // cut from. The map carries the front up to it, holds while the demo plays, then
  // carries it on to the endings.
  const patchFront =
    !onAxonPatch || apU === null
      ? null
      : patchStep <= 1
        ? AXON_MEMBRANE_T * Math.min(1, patchStep)
        : AXON_MEMBRANE_T + (1 - AXON_MEMBRANE_T) * Math.min(1, patchStep - 1)
  const sweptMs = u !== null ? u * screenDurationMs(traj) : chainSweep
  const mapFront =
    patchFront !== null
      ? patchFront
      : sweptMs === null
        ? null
        : AXON_SIGNAL_T + (1 - AXON_SIGNAL_T) * clamp01(sweptMs / MAP_SWEEP_MS)

  const litAt = (at: number) => {
    let lit = 0
    // Once the run is going, ONE front owns the whole axon — including the
    // stretch before the ring, which fired on the way and must not go dark while
    // the rest is still sprinting. Everything behind the front holds a settled
    // glow (it fired; it is recovering, not gone), the front itself is bright,
    // nothing ahead of it lights — and when the sweep reaches the terminals the
    // WHOLE cable is lit and fades out together, because the whole cable fired.
    //
    // It used to hand the pre-ring stretch back to the lead-in's fast fade, so at
    // the finish only the last stretch was still lit: a picture of an axon whose
    // near half had somehow un-fired.
    if (mapFront !== null && at <= mapFront) {
      // The cable holds its settled glow while the wave is still out in the
      // arbor, and only then fades — the whole journey fired, it all lets go
      // together.
      const done =
        mapFront >= 1
          ? Math.max(
              0,
              1 - Math.max(0, sweptMs! - MAP_SWEEP_MS - MAP_ARBOR_MS) / MAP_SETTLE_MS,
            )
          : 1
      const wake = Math.max(0, 1 - (mapFront - at) / (LEAD_WAKE * 1.6))
      lit = Math.max(wake, 0.45) * done
    }
    if (leadFront !== null && at <= leadFront) {
      const settling = u === null ? 1 : Math.max(0, 1 - u * 8)
      lit = Math.max(lit, Math.max(0, 1 - (leadFront - at) / LEAD_WAKE) * settling)
    }
    return lit
  }

  // What the endings do: the wave INVADES the arbor at the sweep's own pace
  // (corrections 2026-09-04 — it used to light as a unit): the overshoot past
  // the axon's end is its time in the branches, each terminal's route covered
  // in turn (layout's terminalReach), then everything settles together.
  const arborMs =
    mapFront === null || mapFront < 1 || sweptMs === null ? null : sweptMs - MAP_SWEEP_MS
  const arborHead =
    arborMs === null || arborMs <= 0 ? null : clamp01(arborMs / MAP_ARBOR_MS)
  const arborSettle =
    arborMs === null
      ? 0
      : Math.max(0, 1 - Math.max(0, arborMs - MAP_ARBOR_MS) / MAP_SETTLE_MS)

  // The lead-in's glows hand the signal on rather than staying lit: they fade over
  // the first moment of the run while the axon's own light comes up. Left alone, a
  // soma lit at the end of the lead-in went on glowing for the whole run.
  const arriving = u === null ? 1 : Math.max(0, 1 - u * 10)
  const handover =
    lead === null
      ? 0
      : clamp01((lead - HILLOCK_FROM) / (AXON_FROM - HILLOCK_FROM)) * arriving

  const rippleAt = lead === null || lead > RIPPLE_UNTIL ? null : lead / RIPPLE_UNTIL
  // A graded potential fades as it spreads — that is what makes it graded, and it
  // is the contrast the axon exists to break.
  const rippleStrength = rippleAt === null ? 0 : 1 - 0.5 * rippleAt
  const somaLit =
    lead === null
      ? 0
      : clamp01((lead - SOMA_FROM) / (AXON_FROM - SOMA_FROM)) * 0.9 * arriving

  // ---------------------------------------------------- the other views' light
  //
  // Off the axon, the map still has to answer "is a spike running, and where".
  // Two sources, because two different things are firing.
  //
  // At a membrane patch: that patch's own spike, read off the same trajectory the
  // canvas is drawing, by the same rule the axon uses — above zero it lights,
  // brightest at the peak. So the thumbnail brightens exactly when the big
  // picture's doors are open, and goes out when it repolarizes.

  // Zoomed out: the chain running across the whole cell. Only the PHASE is in the
  // store — the positions within a phase live in a ref on the stage — so the parts
  // that are not the axon are lit as regions rather than tracked as dots. That is
  // the right amount for a thumbnail beside the full-size version of the same
  // animation. The AXON is not one of them: it gets the same patch-by-patch sweep
  // it gets everywhere else, off the local clock above.
  /** The trunks that carry a signal on THIS run — one function, shared with
   *  the canvas, so the two pictures cannot disagree about which branch the
   *  child chose. */
  const lit = litTrunks(firedInputs)

  // The terminals are NOT a region here any more: they light from the sweep's
  // own arbor clock above, route by route, like the axon they belong to.
  const region = { dendrites: 0, soma: 0, hillock: 0 }
  if (zoom === null) {
    if (phase === 'input-fires' || phase === 'crossing') region.dendrites = 0.5
    else if (phase === 'dendrite') region.dendrites = 0.9
    else if (phase === 'summing') {
      region.dendrites = 0.4
      region.soma = 0.9
    } else if (phase === 'fizzled') {
      region.soma = 0.35
    } else if (phase === 'axon') {
      region.soma = 0.5
      region.hillock = 0.9
    }
  } else if (zoom === 'dendrite-membrane') region.dendrites = apLit
  else if (zoom === 'hillock') region.hillock = apLit

  const glow = (key: string, x: number, y: number, r: number, a: number) =>
    a <= 0.01 ? null : (
      <circle
        key={key}
        cx={x}
        cy={y}
        r={r}
        fill="url(#map-glow)"
        opacity={Math.min(1, a)}
      />
    )

  // No heading and no caption. A drawing of a neuron with one part lit announces
  // itself, and every word this panel used to carry has moved into the describer
  // below it — which is where the app keeps the words, so there is one place to
  // read and one place to look.
  return (
    <div className="relative shrink-0 rounded-xl border border-slate-700 bg-slate-800/60 p-2">
      {/* ⚠ THE WAY OUT LIVES ON THE MAP (user, 2026-09-04: "modify 'back to
          the whole picture' into a minimalistic button, and place it inside
          the 'map neuron' container, in the left bottom corner, for all
          occurrences").
          
          It used to float over the stage, where two views lay a full-width
          control column across the same band and buried it. Here it cannot
          be buried by anything: this panel is permanent, it is the same
          corner in every view, and the picture it sits on IS the whole
          picture it goes back to — so the control and its destination are
          the same object. Minimal, because a corner of a thumbnail is not
          where a big amber pill belongs; the word still NAMES it, since an
          icon alone only ranks. */}
      {zoom !== null && (
        <button
          type="button"
          onClick={() => useNeuronStore.getState().zoomOut()}
          title="Back to the whole picture"
          className="absolute bottom-3 left-3 z-10 rounded-md border border-slate-600/80 bg-slate-950/80 px-1.5 py-0.5 text-[11px] leading-none text-amber-200/90 backdrop-blur transition hover:border-amber-500/60 hover:text-amber-100"
        >
          ⤢ back
        </button>
      )}
      <svg
        viewBox={`${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`}
        className="h-[136px] w-full"
        role="img"
        aria-label={
          target
            ? `The whole neuron, with a ring marking the ${target.label.toLowerCase()} — the part currently filling the main view`
            : 'The whole neuron'
        }
      >
        <defs>
          <radialGradient id="map-glow">
            <stop offset="0%" stopColor={`rgba(${SIGNAL_RGB}, 0.9)`} />
            <stop offset="45%" stopColor={`rgba(${SIGNAL_RGB}, 0.3)`} />
            <stop offset="100%" stopColor={`rgba(${SIGNAL_RGB}, 0)`} />
          </radialGradient>
        </defs>

        {/* The cell at rest, in the grey it is drawn in out on the canvas. */}
        {DENDRITE_SEGS.map((seg, i) => (
          <line
            key={i}
            x1={seg.x1}
            y1={seg.y1}
            x2={seg.x2}
            y2={seg.y2}
            stroke={QUIET}
            strokeWidth={seg.w * 0.9}
            strokeLinecap="round"
          />
        ))}
        {/* ⚠ THE POSTSYNAPTIC NEURON (user, 2026-09-04: "in 'small neuron'
            view, add postsynaptic neuron as well, since it's an actor in this
            demo"). It is the last link of the chain this map lights up, and a
            map that crops it off is a map of half the story. Dimmer than the
            focus cell — it is the other end of the story, not the subject —
            and drawn FIRST, so the cell the map is about sits on top. */}
        <g opacity={0.55}>
          {OUTPUT.dendrites.map((d, i) => (
            <path
              key={`od-${i}`}
              d={dOf(d.path)}
              fill="none"
              stroke={QUIET}
              strokeWidth={3}
              strokeLinecap="round"
            />
          ))}
          <path d={dOf(OUTPUT.axon)} fill="none" stroke={QUIET} strokeWidth={4} />
          <path d={dOf(OUTPUT.outline, true)} fill="rgba(148, 163, 184, 0.3)" />
        </g>
        {/* The traced star soma (neuron (1).svg) — the same silhouette the big
            canvas draws, so the kid meets one cell shape at both registers. */}
        <path d={dOf(SOMA_OUTLINE, true)} fill="rgba(148, 163, 184, 0.3)" />
        {/* The terminal arbor's own branch strokes; the boutons stay discs at
            this size — a teardrop three pixels wide is a disc (level of detail
            cuts both ways). */}
        {TERMINAL_BRANCHES.map((br, i) => (
          <path
            key={`br-${i}`}
            d={dOf(br)}
            fill="none"
            stroke={QUIET}
            strokeWidth={4}
            strokeLinecap="round"
          />
        ))}
        {TERMINALS.map((t, i) => (
          <circle key={i} cx={t.end.x} cy={t.end.y} r={BOUTON_R} fill={QUIET} />
        ))}
        {/* ⚠ THE ASTROCYTES, only where the story needs them (21b-1b): on the
            synapse framings the map shows the two star cells — the SAME
            `astroShape` glyph the big scene draws (re-created 2026-09-04 as a
            faithful trace of the user's astrocyte.svg), because a kid who
            cannot read connects the finger to its cell by SHAPE, not by a
            caption. Map spots sit slightly inboard of the scene's so their
            bodies stay on the sheet (see MAP_ASTROCYTES). */}
        {mapShowsAstrocytes(zoom) &&
          MAP_ASTROCYTES.map((a, i) => {
            const shape = astroShape(a)
            return (
              <g
                key={`astro-${i}`}
                stroke={`rgba(${ASTRO_INK}, 0.9)`}
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              >
                <path d={dOf(shape.soma, true)} fill={`rgba(${ASTRO_INK}, 0.5)`} />
                {/* Its nucleus, from the same decision the canvas asks. */}
                <circle
                  cx={astroNucleus(a).at.x}
                  cy={astroNucleus(a).at.y}
                  r={astroNucleus(a).r}
                  fill="rgba(56, 102, 80, 0.9)"
                  stroke="none"
                />
                {shape.processes.map((pl, k) => (
                  <path key={k} d={dOf(pl)} />
                ))}
              </g>
            )
          })}
        {/* The axon itself, all the way along — so that with the sheath on, the
            gaps between sleeves read as bare axon rather than as breaks in it. */}
        <polyline
          points={AXON_POLYLINE.map((p) => `${p.x},${p.y}`).join(' ')}
          fill="none"
          stroke="rgba(148, 163, 184, 0.5)"
          strokeWidth={myelin ? 8 : 12}
          strokeLinecap="round"
        />
        {/* And the sleeves over it: a beaded line instead of a smooth one, which
            is as much as this size can say and enough to match it to the canvas. */}
        {myelin &&
          Array.from({ length: MAP_SLEEVES }, (_, i) => (
            <polyline
              key={`sl-${i}`}
              points={sleevePoints(i)}
              fill="none"
              stroke={SHEATH_TOP}
              strokeWidth={17}
              strokeLinecap="round"
            />
          ))}

        {/* The ripple coming in — one per dendrite that carries a synapse, each
            travelling tip to soma and fading on the way. */}
        {rippleAt !== null &&
          lit.map((trunk) => {
            const path = DENDRITE_TRUNKS[trunk].path
            // The path runs soma → tip; the ripple travels the other way.
            const at = polylinePoint(path, 1 - rippleAt)
            return (
              <g key={`r-${trunk}`}>
                {glow(
                  `rg-${trunk}`,
                  at.x,
                  at.y,
                  26 * rippleStrength + 6,
                  0.85 * rippleStrength,
                )}
                <circle
                  cx={at.x}
                  cy={at.y}
                  r={4 * rippleStrength + 1}
                  fill={SIGNAL_CORE}
                />
              </g>
            )
          })}

        {glow(
          'soma',
          SOMA.x,
          SOMA.y,
          SOMA_R * 2.1,
          Math.max(somaLit * 0.75, region.soma),
        )}
        {glow(
          'hillock',
          HILLOCK.x,
          HILLOCK.y,
          34,
          Math.max(handover * 0.9, region.hillock),
        )}
        {/* The dendrite fan, lit as a region rather than as a travelling dot —
            see the note above on why a thumbnail beside the full-size animation
            should not try to re-run it. */}
        {region.dendrites > 0.02 &&
          lit.map((trunk) => {
            const at = polylinePoint(DENDRITE_TRUNKS[trunk].path, 0.45)
            return glow(`dr-${trunk}`, at.x, at.y, 44, region.dendrites * 0.8)
          })}

        {/* The axon lighting up, piece by piece — each on its own account, from
            its own place, which is what makes the sweep a consequence rather than
            a sprite. Drawn in a random order it would look the same.

            With the sheath on it lights only at the GAPS, exactly as the canvas
            does: twelve sparks with nothing between them, against a bare axon's
            continuous run. That contrast is the reason to show the sheath here at
            all. */}
        {(myelin
          ? mapNodes
          : Array.from({ length: SEGMENTS }, (_, i) => (i + 0.5) / SEGMENTS)
        ).map((at, i) => {
          const lit = litAt(at)
          if (lit <= 0.02) return null
          const p = polylinePoint(AXON_POLYLINE, at)
          return myelin ? (
            <g key={`ax-${i}`}>
              {glow(`axg-${i}`, p.x, p.y, 20 + 16 * lit, lit)}
              <circle
                cx={p.x}
                cy={p.y}
                r={2 + 3 * lit}
                fill={SIGNAL_CORE}
                opacity={lit}
              />
            </g>
          ) : (
            glow(`ax-${i}`, p.x, p.y, 22 + 12 * lit, lit * 0.85)
          )
        })}
        {arborHead !== null &&
          arborSettle > 0.02 &&
          TERMINALS.map((t, i) => {
            // The wave takes each terminal's own traced route, covering it
            // progressively — never a chord, never all at once; the bouton
            // lights only when the wave reaches it.
            const reach = terminalReach(arborHead, i)
            if (reach <= 0.001) return null
            const arr = terminalArrival(arborHead, i)
            return (
              <g key={`t-${i}`}>
                <path
                  d={dOf(partialPath(t.path, reach))}
                  fill="none"
                  stroke={`rgba(${SIGNAL_RGB}, ${arborSettle})`}
                  strokeWidth={6}
                  strokeLinecap="round"
                />
                {glow(`tg-${i}`, t.end.x, t.end.y, 30, arr * arborSettle * 0.9)}
                <circle
                  cx={t.end.x}
                  cy={t.end.y}
                  r={BOUTON_R}
                  fill={SIGNAL_CORE}
                  opacity={arr * arborSettle}
                />
              </g>
            )
          })}

        {/* You are here — marking the PART, not the point.
            
            It used to ring the zoom target's exact centre, which sounds more
            precise and is in fact less true. A patch of axon membrane and the
            stretch of axon you watch a signal cross are two different points a
            hundred scene units apart, so the mark jumped between them — but at
            this size they are the same place, and the map is already compressing
            six millimetres of modelled axon into ninety micrometres of drawing.
            Precision the picture cannot carry is precision that misleads.
            
            So the axon is marked ALONG its length, and everything else at the
            anchor points its region already defines. Absent when zoomed out, where
            the map and the canvas show the same thing and a ring round the whole
            cell would be marking nothing. */}
        {/* You are here — one dashed ring, on the point the camera flies to.
            
            It was briefly a box round the whole REGION, on the reasoning that a
            patch of axon membrane and the stretch you watch a signal cross are the
            same place at this size. That reasoning was wrong in the way that
            matters: the canvas is showing a small PIECE of axon, and a mark round
            the entire axon says the canvas is showing all of it. A marker's job is
            to say what is on screen. It follows the camera, because that is the
            only thing that knows.
            
            Amber, and it may share the signal's colour because it does not share
            its shape: a thin dashed outline is never mistaken for a glow. What was
            unreadable was amber laid ALONG the axon as a thick stroke, which is a
            lit axon however you dash it. */}
        {target && (
          <circle
            cx={target.center.x}
            cy={target.center.y}
            r={onAxon ? 17 : 26}
            fill="none"
            stroke={MARK}
            strokeWidth={3}
            strokeDasharray="7 5"
          />
        )}
      </svg>
    </div>
  )
}
